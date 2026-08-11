import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import {
  HandheldDeviceEventType,
  HandheldDeviceStatus,
  UserEventType,
  UserStatus,
} from '@prisma/client';
import { createHash, randomBytes, randomUUID, timingSafeEqual } from 'crypto';
import { PrismaService } from '../../../infrastructure/prisma/prisma.service';
import {
  ACCESS_TOKEN_TTL_SECONDS,
  REFRESH_TOKEN_TTL_MS,
  accessTokenSecret,
} from '../auth.constants';
import { ChangePasswordDto } from '../dto/change-password.dto';
import { LoginDto } from '../dto/login.dto';
import type { AccessTokenPayload } from '../interfaces/authenticated-user.interface';
import { CredentialService } from './credential.service';
import { HandheldLoginDto } from '../../handheld/dto/handheld-login.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly credentials: CredentialService,
  ) {}

  async login(dto: LoginDto, requestId?: string) {
    const email = dto.email.trim().toLowerCase();
    return this.prisma.$transaction(async (tx) => {
      const current = await tx.user.findUnique({
        where: { email },
        include: { snapshot: true },
      });
      if (
        !current?.passwordHash ||
        current.snapshot?.currentStatus !== UserStatus.ACTIVE ||
        !(await this.credentials.verifyPassword(
          dto.password,
          current.passwordHash,
        ))
      ) {
        throw new UnauthorizedException('Invalid credentials');
      }

      const issued = await this.issueTokens(
        current.id,
        current.email,
        current.tokenVersion,
        current.snapshot.roleNames,
        current.snapshot.permissions,
      );
      await tx.refreshToken.create({ data: issued.refreshTokenRecord });
      const event = await tx.userEvent.create({
        data: {
          userId: current.id,
          eventType: UserEventType.USER_AUTHENTICATED,
          actorUserId: current.id,
          correlationId: requestId ?? randomUUID(),
        },
      });
      await tx.userSnapshot.update({
        where: { userId: current.id },
        data: {
          lastLoginAt: event.createdAt,
          lastActivityAt: event.createdAt,
        },
      });

      return issued.response;
    });
  }

  /** Badge and employee number identify the operator; a provisioned device
   * credential proves the login originated from an enrolled installation. */
  async loginHandheld(dto: HandheldLoginDto, requestId?: string) {
    const badgeBarcode = dto.badgeBarcode.trim().toUpperCase();
    const employeeNumber = dto.employeeId.trim().toUpperCase();
    return this.prisma.$transaction(async (tx) => {
      const device = await tx.handheldDevice.findUnique({
        where: { deviceId: dto.deviceId },
        include: { snapshot: true },
      });
      const current = await tx.user.findUnique({
        where: { badgeBarcode },
        include: { snapshot: true, primaryTerminal: true },
      });
      // Always perform the same fixed-length comparison, including for an
      // unknown device, so enrollment state is not exposed by an early return.
      const deviceCredentialMatches = this.matchesCredential(
        dto.deviceCredential,
        device?.credentialHash ?? '0'.repeat(64),
      );
      if (
        !device?.snapshot ||
        device.snapshot.currentStatus !== HandheldDeviceStatus.ACTIVE ||
        !deviceCredentialMatches ||
        !current ||
        current.employeeNumber !== employeeNumber ||
        current.snapshot?.currentStatus !== UserStatus.ACTIVE ||
        !current.primaryTerminal
      ) {
        throw new UnauthorizedException('Invalid employee badge or employee ID');
      }

      const issued = await this.issueTokens(
        current.id,
        current.email,
        current.tokenVersion,
        current.snapshot.roleNames,
        current.snapshot.permissions,
        device.id,
      );
      await tx.refreshToken.create({ data: issued.refreshTokenRecord });
      const correlationId = requestId ?? randomUUID();
      const event = await tx.userEvent.create({
        data: {
          userId: current.id,
          eventType: UserEventType.USER_AUTHENTICATED,
          actorUserId: current.id,
          correlationId,
          metadata: { client: 'HANDHELD', deviceId: dto.deviceId },
        },
      });
      await tx.userSnapshot.update({
        where: { userId: current.id },
        data: { lastLoginAt: event.createdAt, lastActivityAt: event.createdAt },
      });
      const deviceEvent = await tx.handheldDeviceEvent.create({
        data: {
          handheldDeviceId: device.id,
          eventType: HandheldDeviceEventType.DEVICE_AUTHENTICATED,
          actorUserId: current.id,
          correlationId,
        },
      });
      await tx.handheldDeviceSnapshot.update({
        where: { id: device.id },
        data: {
          lastAuthenticatedAt: deviceEvent.createdAt,
          lastActivityAt: deviceEvent.createdAt,
        },
      });

      return {
        ...issued.response,
        employee: {
          id: current.id,
          employeeNumber: current.employeeNumber,
          firstName: current.firstName,
          lastName: current.lastName,
          roles: current.snapshot.roleNames,
        },
        terminal: {
          id: current.primaryTerminal.id,
          terminalCode: current.primaryTerminal.terminalCode,
          name: current.primaryTerminal.name,
        },
      };
    });
  }

  refresh(refreshToken: string, requestId?: string) {
    const tokenHash = this.hashToken(refreshToken);
    return this.prisma.$transaction(async (tx) => {
      const stored = await tx.refreshToken.findUnique({
        where: { tokenHash },
        include: {
          user: { include: { snapshot: true } },
          handheldDevice: { include: { snapshot: true } },
        },
      });
      const now = new Date();
      if (
        !stored ||
        stored.revokedAt ||
        stored.expiresAt <= now ||
        stored.user.snapshot?.currentStatus !== UserStatus.ACTIVE ||
        (stored.handheldDeviceId !== null &&
          stored.handheldDevice?.snapshot?.currentStatus !==
            HandheldDeviceStatus.ACTIVE)
      ) {
        throw new UnauthorizedException('Invalid refresh token');
      }

      await tx.refreshToken.update({
        where: { id: stored.id },
        data: { revokedAt: now },
      });
      const snapshot = stored.user.snapshot;
      const issued = await this.issueTokens(
        stored.user.id,
        stored.user.email,
        stored.user.tokenVersion,
        snapshot.roleNames,
        snapshot.permissions,
        stored.handheldDeviceId ?? undefined,
      );
      await tx.refreshToken.create({ data: issued.refreshTokenRecord });
      const event = await tx.userEvent.create({
        data: {
          userId: stored.user.id,
          eventType: UserEventType.REFRESH_TOKEN_ROTATED,
          actorUserId: stored.user.id,
          correlationId: requestId ?? randomUUID(),
          payload: { revokedRefreshTokenId: stored.id },
        },
      });
      await tx.userSnapshot.update({
        where: { userId: stored.user.id },
        data: { lastActivityAt: event.createdAt },
      });
      if (stored.handheldDeviceId) {
        const deviceEvent = await tx.handheldDeviceEvent.create({
          data: {
            handheldDeviceId: stored.handheldDeviceId,
            eventType: HandheldDeviceEventType.DEVICE_TOKEN_REFRESHED,
            actorUserId: stored.user.id,
            correlationId: event.correlationId,
          },
        });
        await tx.handheldDeviceSnapshot.update({
          where: { id: stored.handheldDeviceId },
          data: { lastActivityAt: deviceEvent.createdAt },
        });
      }

      return issued.response;
    });
  }

  logout(userId: string, refreshToken: string, requestId?: string) {
    const tokenHash = this.hashToken(refreshToken);
    return this.prisma.$transaction(async (tx) => {
      const stored = await tx.refreshToken.findUnique({ where: { tokenHash } });
      if (!stored || stored.userId !== userId || stored.revokedAt) {
        throw new UnauthorizedException('Invalid refresh token');
      }

      const revokedAt = new Date();
      await tx.refreshToken.update({
        where: { id: stored.id },
        data: { revokedAt },
      });
      const event = await tx.userEvent.create({
        data: {
          userId,
          eventType: UserEventType.USER_LOGGED_OUT,
          actorUserId: userId,
          correlationId: requestId ?? randomUUID(),
          payload: { revokedRefreshTokenId: stored.id },
        },
      });
      await tx.userSnapshot.update({
        where: { userId },
        data: { lastActivityAt: event.createdAt },
      });

      return { loggedOut: true };
    });
  }

  async changePassword(
    userId: string,
    dto: ChangePasswordDto,
    requestId?: string,
  ) {
    if (dto.currentPassword === dto.newPassword) {
      throw new BadRequestException('New password must be different');
    }
    const passwordHash = await this.credentials.hashPassword(dto.newPassword);

    return this.prisma.$transaction(async (tx) => {
      const current = await tx.user.findUnique({ where: { id: userId } });
      if (
        !current?.passwordHash ||
        !(await this.credentials.verifyPassword(
          dto.currentPassword,
          current.passwordHash,
        ))
      ) {
        throw new UnauthorizedException('Current password is invalid');
      }
      await tx.user.update({
        where: { id: userId },
        data: { passwordHash, tokenVersion: { increment: 1 } },
      });
      await tx.refreshToken.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      const event = await tx.userEvent.create({
        data: {
          userId,
          eventType: UserEventType.PASSWORD_CHANGED,
          actorUserId: userId,
          correlationId: requestId ?? randomUUID(),
        },
      });
      await tx.userSnapshot.update({
        where: { userId },
        data: { lastActivityAt: event.createdAt },
      });

      return { passwordChanged: true };
    });
  }

  async getCurrentUser(userId: string) {
    const snapshot = await this.prisma.userSnapshot.findUnique({
      where: { userId },
    });
    if (!snapshot || snapshot.currentStatus !== UserStatus.ACTIVE) {
      throw new UnauthorizedException();
    }
    return snapshot;
  }

  private async issueTokens(
    userId: string,
    email: string,
    tokenVersion: number,
    roles: string[],
    permissions: string[],
    handheldDeviceId?: string,
  ) {
    const payload: AccessTokenPayload = {
      sub: userId,
      email,
      roles,
      permissions,
      tokenVersion,
      type: 'access',
      ...(handheldDeviceId && { handheldDeviceId }),
    };
    const accessToken = await this.jwtService.signAsync(payload, {
      secret: accessTokenSecret(),
      expiresIn: ACCESS_TOKEN_TTL_SECONDS,
    });
    const refreshToken = randomBytes(48).toString('base64url');
    const expiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL_MS);

    return {
      response: {
        accessToken,
        refreshToken,
        tokenType: 'Bearer',
        expiresIn: ACCESS_TOKEN_TTL_SECONDS,
      },
      refreshTokenRecord: {
        userId,
        tokenHash: this.hashToken(refreshToken),
        expiresAt,
        ...(handheldDeviceId && { handheldDeviceId }),
      },
    };
  }

  private hashToken(token: string) {
    return createHash('sha256').update(token).digest('hex');
  }

  private matchesCredential(credential: string, expectedHash: string) {
    const actual = Buffer.from(this.hashToken(credential), 'hex');
    const expected = Buffer.from(expectedHash, 'hex');
    return actual.length === expected.length && timingSafeEqual(actual, expected);
  }
}
