import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  HandheldDeviceEventType,
  HandheldDeviceStatus,
} from '@prisma/client';
import { createHash, randomBytes, randomUUID } from 'crypto';
import { PrismaService } from '../../../infrastructure/prisma/prisma.service';
import { EnrollHandheldDeviceDto } from '../dto/enroll-handheld-device.dto';

@Injectable()
export class HandheldDeviceService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Returns the credential once. Only its hash is committed with the device
   * aggregate, enrollment event, and current snapshot.
   */
  enroll(
    dto: EnrollHandheldDeviceDto,
    actorUserId: string,
    correlationId: string = randomUUID(),
  ) {
    const credential = randomBytes(32).toString('base64url');
    const credentialHash = this.hashCredential(credential);
    const displayName = dto.displayName.trim();

    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.handheldDevice.findUnique({
        where: { deviceId: dto.deviceId },
        include: { snapshot: true },
      });
      if (existing?.snapshot?.currentStatus === HandheldDeviceStatus.ACTIVE) {
        throw new ConflictException('Device is already enrolled');
      }

      const device = existing
        ? await tx.handheldDevice.update({
            where: { id: existing.id },
            data: { credentialHash },
          })
        : await tx.handheldDevice.create({
            data: { deviceId: dto.deviceId, credentialHash },
          });
      const event = await tx.handheldDeviceEvent.create({
        data: {
          handheldDeviceId: device.id,
          eventType: HandheldDeviceEventType.DEVICE_ENROLLED,
          actorUserId,
          correlationId,
          payload: { displayName, platform: dto.platform },
        },
      });
      const snapshot = existing
        ? await tx.handheldDeviceSnapshot.update({
            where: { id: device.id },
            data: {
              displayName,
              platform: dto.platform,
              currentStatus: HandheldDeviceStatus.ACTIVE,
              enrolledAt: event.createdAt,
              revokedAt: null,
              lastAuthenticatedAt: null,
              lastActivityAt: event.createdAt,
            },
          })
        : await tx.handheldDeviceSnapshot.create({
            data: {
              id: device.id,
              deviceId: device.deviceId,
              displayName,
              platform: dto.platform,
              currentStatus: HandheldDeviceStatus.ACTIVE,
              enrolledAt: event.createdAt,
              lastActivityAt: event.createdAt,
            },
          });

      return { device: snapshot, credential };
    });
  }

  // Device administration reads only the current snapshot projection.
  list() {
    return this.prisma.handheldDeviceSnapshot.findMany({
      orderBy: [{ currentStatus: 'asc' }, { displayName: 'asc' }],
    });
  }

  revoke(
    id: string,
    actorUserId: string,
    correlationId: string = randomUUID(),
  ) {
    return this.prisma.$transaction(async (tx) => {
      const device = await tx.handheldDevice.findUnique({
        where: { id },
        include: { snapshot: true },
      });
      if (!device?.snapshot) throw new NotFoundException('Device not found');
      if (device.snapshot.currentStatus === HandheldDeviceStatus.REVOKED) {
        return device.snapshot;
      }

      const event = await tx.handheldDeviceEvent.create({
        data: {
          handheldDeviceId: id,
          eventType: HandheldDeviceEventType.DEVICE_REVOKED,
          actorUserId,
          correlationId,
        },
      });
      const snapshot = await tx.handheldDeviceSnapshot.update({
        where: { id },
        data: {
          currentStatus: HandheldDeviceStatus.REVOKED,
          revokedAt: event.createdAt,
          lastActivityAt: event.createdAt,
        },
      });
      // Bound refresh sessions are revoked in the same transaction as the
      // device event and projection update.
      await tx.refreshToken.updateMany({
        where: { handheldDeviceId: id, revokedAt: null },
        data: { revokedAt: event.createdAt },
      });
      return snapshot;
    });
  }

  private hashCredential(credential: string) {
    return createHash('sha256').update(credential).digest('hex');
  }
}
