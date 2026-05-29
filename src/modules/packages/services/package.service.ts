import { Injectable } from '@nestjs/common';
import {PackageEventType,PackageStatus,} from '@prisma/client';
import { BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/prisma/prisma.service';
// Kafka publishing service
import { KafkaService } from '../../../infrastructure/kafka/kafka.service';
import { CreatePackageEventDto } from '../dto/create-package-event.dto';
import { AppLogger } from '../../../common/utils/logger';
import { PackageTransitionValidator } from '../validators/package-transition.validator';

@Injectable()
export class PackageService {
  constructor(
  // Inject Prisma database service
  private readonly prisma: PrismaService,

  // Inject Kafka publishing service
  private readonly kafkaService: KafkaService,

   // Operational transition validator
  private readonly transitionValidator: PackageTransitionValidator,
) {}

  async createPackageEvent(dto: CreatePackageEventDto, requestId?: string,) {

    // Log workflow start
    AppLogger.log(
  `[${requestId}] Processing package event: ${dto.eventType}`,
    );
  // Execute DB operations inside transaction
  const result = await this.prisma.$transaction(async (tx) => {

    // Try finding existing package snapshot
    let snapshot = await tx.packageSnapshot.findUnique({
      where: {
        trackingNumber: dto.trackingNumber,
      },
    });

        // Skip validation on first scan
     if (snapshot) {
      console.log('Current Status:',snapshot.currentStatus,'Next Event:',dto.eventType,);
      this.transitionValidator.validateTransition(
      snapshot.currentStatus,
      dto.eventType,
      );
     }
    // Create snapshot if package does not exist yet
    if (!snapshot) {

      // First event must always be PACKAGE_RECEIVED
      if (dto.eventType !== PackageEventType.PACKAGE_RECEIVED) {
        throw new BadRequestException(
          'First package event must be PACKAGE_RECEIVED',
        );
      }

      snapshot = await tx.packageSnapshot.create({
        data: {
          trackingNumber: dto.trackingNumber,
          currentStatus: PackageStatus.RECEIVED,
        },
      });

        // Log snapshot creation
        AppLogger.log(
          `Created snapshot for ${dto.trackingNumber}`,
        );
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
      PACKAGE_RECEIVED:PackageStatus.RECEIVED,

      PACKAGE_SORTED: PackageStatus.SORTED,

      PACKAGE_LOADED_TO_CONTAINER:PackageStatus.IN_CONTAINER,

      PACKAGE_UNLOADED_FROM_CONTAINER:PackageStatus.SORTED,

      PACKAGE_LOADED_TO_TRAILER:PackageStatus.IN_TRAILER,

      PACKAGE_UNLOADED_FROM_TRAILER:PackageStatus.ARRIVED,

      PACKAGE_DEPARTED:PackageStatus.DEPARTED,

      PACKAGE_ARRIVED:PackageStatus.ARRIVED,

      PACKAGE_OUT_FOR_DELIVERY:PackageStatus.OUT_FOR_DELIVERY,

      PACKAGE_DELIVERED:PackageStatus.DELIVERED,
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
    `[${requestId}] Publishing package event to Kafka`,
    );

  // Publish Kafka event AFTER successful transaction commit
  await this.kafkaService.publish('package-events', {
    requestId,
    trackingNumber: dto.trackingNumber,
    eventType: dto.eventType,
    terminalId: dto.terminalId,
    employeeId: dto.employeeId,
    createdAt: new Date(),
    },
  );

  return result;
}
}

