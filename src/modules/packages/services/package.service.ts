import { Injectable } from '@nestjs/common';
import {
  PackageEventType,
  PackageStatus,
} from '@prisma/client';

import { PrismaService } from '../../../infrastructure/prisma/prisma.service';
import { CreatePackageEventDto } from '../dto/create-package-event.dto';

@Injectable()
export class PackageService {
  constructor(private readonly prisma: PrismaService) {}

  async createPackageEvent(dto: CreatePackageEventDto) {
    return this.prisma.$transaction(async (tx) => {
      let snapshot = await tx.packageSnapshot.findUnique({
        where: {
          trackingNumber: dto.trackingNumber,
        },
      });

      if (!snapshot) {
        snapshot = await tx.packageSnapshot.create({
          data: {
            trackingNumber: dto.trackingNumber,
            currentStatus: PackageStatus.CREATED,
          },
        });
      }

      const event = await tx.packageEvent.create({
        data: {
          packageId: snapshot.id,
          eventType: dto.eventType,
          terminalId: dto.terminalId,
          employeeId: dto.employeeId,
        },
      });

      const statusMap: Record<PackageEventType, PackageStatus> = {
        PACKAGE_CREATED: PackageStatus.CREATED,
        PACKAGE_RECEIVED: PackageStatus.RECEIVED,
        PACKAGE_IN_TRANSIT: PackageStatus.IN_TRANSIT,
        PACKAGE_DELIVERED: PackageStatus.DELIVERED,
      };

      const updatedSnapshot = await tx.packageSnapshot.update({
        where: {
          id: snapshot.id,
        },
        data: {
          currentStatus: statusMap[dto.eventType],
          currentTerminalId: dto.terminalId,
        },
      });

      return {
        snapshot: updatedSnapshot,
        event,
      };
    });
  }
}