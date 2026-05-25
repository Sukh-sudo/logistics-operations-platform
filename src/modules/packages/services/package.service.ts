import { Injectable } from '@nestjs/common';
import {
  PackageEventType,
  PackageStatus,
} from '@prisma/client';

import { PrismaService } from '../../../infrastructure/prisma/prisma.service';
// Kafka publishing service
import { KafkaService } from '../../../infrastructure/kafka/kafka.service';
import { CreatePackageEventDto } from '../dto/create-package-event.dto';
import { AppLogger } from '../../../common/utils/logger';

@Injectable()
export class PackageService {
  constructor(
  // Inject Prisma database service
  private readonly prisma: PrismaService,

  // Inject Kafka publishing service
  private readonly kafkaService: KafkaService,
) {}

  async createPackageEvent(dto: CreatePackageEventDto) {

    // Log workflow start
    AppLogger.log(
   `Processing package event: ${dto.eventType}`,
    );
  // Execute DB operations inside transaction
  const result = await this.prisma.$transaction(async (tx) => {

    // Try finding existing package snapshot
    let snapshot = await tx.packageSnapshot.findUnique({
      where: {
        trackingNumber: dto.trackingNumber,
      },
    });

    // Create snapshot if package does not exist yet
    if (!snapshot) {
        // Log snapshot creation
        AppLogger.log(
        `Creating snapshot for ${dto.trackingNumber}`,
        );
      snapshot = await tx.packageSnapshot.create({
        data: {
          trackingNumber: dto.trackingNumber,
          currentStatus: PackageStatus.CREATED,
        },
      });
    }

    // Append immutable package event
    const event = await tx.packageEvent.create({
      data: {
        packageId: snapshot.id,
        eventType: dto.eventType,
        terminalId: dto.terminalId,
        employeeId: dto.employeeId,
      },
    });

    // Map event type to operational package status
    const statusMap: Record<PackageEventType, PackageStatus> = {
      PACKAGE_CREATED: PackageStatus.CREATED,
      PACKAGE_RECEIVED: PackageStatus.RECEIVED,
      PACKAGE_IN_TRANSIT: PackageStatus.IN_TRANSIT,
      PACKAGE_DELIVERED: PackageStatus.DELIVERED,
    };

    // Update current operational snapshot
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

  // Log Kafka publication attempt
    AppLogger.log(
    `Publishing package event to Kafka`,
    );

  // Publish Kafka event AFTER successful transaction commit
  await this.kafkaService.publish('package-events', {
    trackingNumber: dto.trackingNumber,
    eventType: dto.eventType,
    terminalId: dto.terminalId,
    employeeId: dto.employeeId,
    createdAt: new Date(),
  });

  return result;
}
}
