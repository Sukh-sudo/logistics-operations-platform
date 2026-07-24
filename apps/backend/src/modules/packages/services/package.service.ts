import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import {
  PackageEventType,
  PackageStatus,
  ProjectionStatus,
  TerminalEventType,
  TerminalStatus,
} from '@prisma/client';
import { randomUUID } from 'crypto';
import { PrismaService } from '../../../infrastructure/prisma/prisma.service';
// Kafka publishing service
import { KafkaService } from '../../../infrastructure/kafka/kafka.service';
import { CreatePackageEventDto } from '../dto/create-package-event.dto';
import { logApplicationEvent } from '../../../common/utils/logger';
import { PackageTransitionValidator } from '../validators/package-transition.validator';
import { packageTypeFromIdentifier } from '../../../common/domain/asset-identifiers';
import { ShipmentService } from '../../shipments/services/shipment.service';

@Injectable()
export class PackageService {
  constructor(
  // Inject Prisma database service
  private readonly prisma: PrismaService,

  // Inject Kafka publishing service
  private readonly kafkaService: KafkaService,

   // Operational transition validator
  private readonly transitionValidator: PackageTransitionValidator,

  // Shipment projections observe committed package movement events.
  private readonly shipmentService: ShipmentService,
) {}

  async createPackageEvent(dto: CreatePackageEventDto, requestId?: string,) {
    const correlationId = requestId ?? randomUUID();

    // Log workflow start
    logApplicationEvent('log', PackageService.name, 'Processing package event', {
      requestId,
      correlationId,
      eventType: dto.eventType,
      trackingNumber: dto.trackingNumber,
    });
  // Execute DB operations inside transaction
  const result = await this.prisma.$transaction(async (tx) => {

    // Try finding existing package snapshot.
    let snapshot = await tx.packageSnapshot.findUnique({
      where: {
        trackingNumber: dto.trackingNumber,
      },
    });

        // Skip validation on first scan
     if (snapshot) {
      this.transitionValidator.validateTransition(
      snapshot.currentStatus,
      dto.eventType,
      );
     }
    const isNewPackage = !snapshot;

    // Create snapshot if package does not exist yet.
    if (!snapshot) {

      // First event must always be PACKAGE_RECEIVED
      if (dto.eventType !== PackageEventType.PACKAGE_RECEIVED) {
        throw new BadRequestException(
          'First package event must be PACKAGE_RECEIVED',
        );
      }

      if (dto.terminalId === undefined) {
        throw new BadRequestException(
          'A terminal is required when a package is received',
        );
      }
      const terminal = await tx.terminal.findUnique({
        where: { id: dto.terminalId },
        include: { snapshot: true },
      });
      if (!terminal?.snapshot) {
        throw new NotFoundException('Terminal not found');
      }
      if (terminal.snapshot.currentStatus === TerminalStatus.CLOSED) {
        throw new BadRequestException('Closed terminals cannot receive packages');
      }

      const packageType = packageTypeFromIdentifier(dto.trackingNumber);
      const aggregate = await tx.package.create({
        data: {
          trackingNumber: dto.trackingNumber,
          packageType,
        },
      });

      snapshot = await tx.packageSnapshot.create({
        data: {
          id: aggregate.id,
          trackingNumber: dto.trackingNumber,
          packageType,
          currentStatus: PackageStatus.RECEIVED,
          currentTerminalId: dto.terminalId,
        },
      });

        // Log snapshot creation
        logApplicationEvent('log', PackageService.name, 'Created package snapshot', {
          requestId,
          correlationId,
          trackingNumber: dto.trackingNumber,
        });
      }
    const nextStatus = this.statusForEvent(dto.eventType);
    const terminalDepartureEvents: PackageEventType[] = [
      PackageEventType.PACKAGE_DEPARTED,
      PackageEventType.PACKAGE_OUT_FOR_DELIVERY,
    ];
    const leavesTerminalEvents: PackageEventType[] = [
      ...terminalDepartureEvents,
      PackageEventType.PACKAGE_DELIVERED,
    ];
    const leavesTerminal = leavesTerminalEvents.includes(dto.eventType);
    const nextTerminalId = leavesTerminal
      ? null
      : dto.terminalId ?? snapshot.currentTerminalId;

    if (
      !isNewPackage &&
      dto.terminalId !== undefined &&
      !([
        PackageEventType.PACKAGE_ARRIVED,
        PackageEventType.PACKAGE_DELIVERED,
      ] as PackageEventType[]).includes(dto.eventType) &&
      snapshot.currentTerminalId !== dto.terminalId
    ) {
      throw new BadRequestException(
        'Package event terminal does not match current terminal ownership',
      );
    }

    if (
      !isNewPackage &&
      dto.eventType === PackageEventType.PACKAGE_ARRIVED
    ) {
      if (dto.terminalId === undefined) {
        throw new BadRequestException(
          'A destination terminal is required when a package arrives',
        );
      }
      const destination = await tx.terminal.findUnique({
        where: { id: dto.terminalId },
        include: { snapshot: true },
      });
      if (!destination?.snapshot) {
        throw new NotFoundException('Terminal not found');
      }
      if (destination.snapshot.currentStatus === TerminalStatus.CLOSED) {
        throw new BadRequestException('Closed terminals cannot receive packages');
      }
    }

    // Append immutable package event
  const event = await tx.packageEvent.create({
      data: {
        packageId: snapshot.id,
        eventType: dto.eventType,
        terminalId:
          dto.terminalId ??
          (terminalDepartureEvents.includes(dto.eventType)
            ? snapshot.currentTerminalId
            : undefined),
        employeeId: dto.employeeId,
        correlationId,
        metadata: {
          ...(dto.eventType === PackageEventType.PACKAGE_RECEIVED
            ? { packageType: snapshot.packageType }
            : {}),
          currentStatus: nextStatus,
          currentTerminalId: nextTerminalId,
        },
      },
    });

    await tx.packageProjectionOutbox.create({
      data: { packageEventId: event.id },
    });

    if (dto.eventType === PackageEventType.PACKAGE_RECEIVED) {
      const terminalEvent = await tx.terminalEvent.create({
        data: {
          terminalId: dto.terminalId!,
          eventType: TerminalEventType.PACKAGE_RECEIVED,
          employeeId: dto.employeeId,
          correlationId,
          payload: {
            packageId: snapshot.id,
            trackingNumber: snapshot.trackingNumber,
          },
        },
      });
      await tx.terminalSnapshot.update({
        where: { terminalId: dto.terminalId! },
        data: {
          packageCount: { increment: 1 },
          lastActivityAt: terminalEvent.createdAt,
        },
      });
    }

    if (
      !isNewPackage &&
      terminalDepartureEvents.includes(dto.eventType)
    ) {
      if (snapshot.currentTerminalId === null) {
        throw new BadRequestException(
          'Package must be owned by a terminal before it can depart',
        );
      }
      const terminalEvent = await tx.terminalEvent.create({
        data: {
          terminalId: snapshot.currentTerminalId,
          eventType: TerminalEventType.PACKAGE_TRANSFERRED,
          employeeId: dto.employeeId,
          correlationId,
          payload: {
            packageId: snapshot.id,
            trackingNumber: snapshot.trackingNumber,
            direction:
              dto.eventType === PackageEventType.PACKAGE_OUT_FOR_DELIVERY
                ? 'OUT_FOR_DELIVERY'
                : 'DEPARTED',
          },
        },
      });
      await tx.terminalSnapshot.update({
        where: { terminalId: snapshot.currentTerminalId },
        data: {
          packageCount: { decrement: 1 },
          lastActivityAt: terminalEvent.createdAt,
        },
      });
    }

    if (
      !isNewPackage &&
      dto.eventType === PackageEventType.PACKAGE_ARRIVED
    ) {
      const terminalEvent = await tx.terminalEvent.create({
        data: {
          terminalId: dto.terminalId!,
          eventType: TerminalEventType.PACKAGE_RECEIVED,
          employeeId: dto.employeeId,
          correlationId,
          payload: {
            packageId: snapshot.id,
            trackingNumber: snapshot.trackingNumber,
            reason: 'ARRIVAL',
          },
        },
      });
      await tx.terminalSnapshot.update({
        where: { terminalId: dto.terminalId! },
        data: {
          packageCount: { increment: 1 },
          lastActivityAt: terminalEvent.createdAt,
        },
      });
    }

    // Update current operational snapshot
    const updatedSnapshot = await tx.packageSnapshot.update({
      where: {
        id: snapshot.id,
      },
      data: {
        currentStatus: nextStatus,
        currentTerminalId: nextTerminalId,
      },
    });

    return {
      snapshot: updatedSnapshot,
      event,
    };
  });

  // Log Kafka publication attempt
    logApplicationEvent('log', PackageService.name, 'Publishing package event', {
      requestId,
      correlationId,
      trackingNumber: dto.trackingNumber,
      eventType: dto.eventType,
    });

  // Publish Kafka event AFTER successful transaction commit
  await this.kafkaService.publish('package-events', {
    requestId: correlationId,
    trackingNumber: dto.trackingNumber,
    eventType: dto.eventType,
    terminalId: dto.terminalId,
    employeeId: dto.employeeId,
    createdAt: new Date(),
    },
  );

  // Update customer-facing shipment state only after package state commits.
  // The shipment service owns its event and snapshot transaction.
  await this.processProjection(result.event.id);

  return result;
}

async getPackage(
  trackingNumber: string,
) {
  const snapshot =
    await this.prisma.packageSnapshot.findUnique({
      where: { trackingNumber },
    });

  if (!snapshot) {
    throw new NotFoundException(
      'Package not found',
    );
  }

  return snapshot;
}

async getPackageHistory(
  trackingNumber: string,
) {
  const snapshot = await this.prisma.packageSnapshot.findUnique({
    where: { trackingNumber },
  });

  if (!snapshot) {
    throw new NotFoundException(
      'Package not found',
    );
  }

  return this.prisma.packageEvent.findMany({
    where: { packageId: snapshot.id },
    orderBy: { createdAt: 'asc' },
  });
}

async getPackageLocation(
  trackingNumber: string,
) {
  const packageSnapshot =
    await this.prisma.packageSnapshot.findUnique({
      where: {
        trackingNumber,
      },
    });

  if (!packageSnapshot) {
    throw new NotFoundException(
      'Package not found',
    );
  }

  let containerBarcode: string | null = null;
  let trailerBarcode: string | null = null;

  if (packageSnapshot.currentContainerId) {
    const container =
      await this.prisma.containerSnapshot.findUnique({
        where: {
          id: packageSnapshot.currentContainerId,
        },
      });

    containerBarcode =
      container?.containerBarcode ?? null;

    if (container?.currentTrailerId) {
      const trailer =
        await this.prisma.trailerSnapshot.findUnique({
          where: {
            id: container.currentTrailerId,
          },
        });

      trailerBarcode =
        trailer?.trailerBarcode ?? null;
    }
  }

  if (
    !trailerBarcode &&
    packageSnapshot.currentTrailerId
  ) {
    const trailer =
      await this.prisma.trailerSnapshot.findUnique({
        where: {
          id: packageSnapshot.currentTrailerId,
        },
      });

    trailerBarcode =
      trailer?.trailerBarcode ?? null;
  }

  return {
    trackingNumber:
      packageSnapshot.trackingNumber,
    currentStatus:
      packageSnapshot.currentStatus,
    containerBarcode,
    trailerBarcode,
  };
}

/**
 * Replays pending/failed package projections. The outbox row is committed
 * with the source event, so a failed in-process projection is never lost.
 */
async retryPendingProjections(limit = 100) {
  const staleBefore = new Date(Date.now() - 5 * 60 * 1000);
  const pending = await this.prisma.packageProjectionOutbox.findMany({
    where: {
      OR: [
        { status: { in: [ProjectionStatus.PENDING, ProjectionStatus.FAILED] } },
        {
          status: ProjectionStatus.PROCESSING,
          updatedAt: { lt: staleBefore },
        },
      ],
    },
    orderBy: { createdAt: 'asc' },
    take: limit,
  });
  for (const item of pending) {
    await this.processProjection(item.packageEventId, staleBefore);
  }
  return { processed: pending.length };
}

async processProjection(packageEventId: string, staleBefore?: Date) {
  const claimed = await this.prisma.packageProjectionOutbox.updateMany({
    where: {
      packageEventId,
      OR: [
        { status: { in: [ProjectionStatus.PENDING, ProjectionStatus.FAILED] } },
        ...(staleBefore
          ? [{
              status: ProjectionStatus.PROCESSING,
              updatedAt: { lt: staleBefore },
            }]
          : []),
      ],
    },
    data: {
      status: ProjectionStatus.PROCESSING,
      attempts: { increment: 1 },
      lastError: null,
    },
  });
  if (claimed.count === 0) {
    return;
  }

  const source = await this.prisma.packageEvent.findUnique({
    where: { id: packageEventId },
    include: { package: true },
  });
  if (!source) {
    await this.prisma.packageProjectionOutbox.update({
      where: { packageEventId },
      data: {
        status: ProjectionStatus.FAILED,
        lastError: 'Source package event was not found',
      },
    });
    return;
  }

  try {
    await this.shipmentService.synchronizePackageProgress(
      source.package.trackingNumber,
      source.eventType,
      source.terminalId ?? undefined,
      source.correlationId,
      source.id,
    );
    await this.prisma.packageProjectionOutbox.update({
      where: { packageEventId },
      data: {
        status: ProjectionStatus.COMPLETED,
        processedAt: new Date(),
      },
    });
  } catch (error) {
    await this.prisma.packageProjectionOutbox.update({
      where: { packageEventId },
      data: {
        status: ProjectionStatus.FAILED,
        lastError: error instanceof Error ? error.message : 'Unknown error',
      },
    });
  }
}

private statusForEvent(eventType: PackageEventType) {
  const statuses: Record<PackageEventType, PackageStatus> = {
    PACKAGE_RECEIVED: PackageStatus.RECEIVED,
    PACKAGE_SORTED: PackageStatus.SORTED,
    PACKAGE_LOADED_TO_CONTAINER: PackageStatus.IN_CONTAINER,
    PACKAGE_UNLOADED_FROM_CONTAINER: PackageStatus.SORTED,
    PACKAGE_LOADED_TO_TRAILER: PackageStatus.IN_TRAILER,
    PACKAGE_UNLOADED_FROM_TRAILER: PackageStatus.ARRIVED,
    PACKAGE_DEPARTED: PackageStatus.DEPARTED,
    PACKAGE_ARRIVED: PackageStatus.ARRIVED,
    PACKAGE_OUT_FOR_DELIVERY: PackageStatus.OUT_FOR_DELIVERY,
    PACKAGE_DELIVERED: PackageStatus.DELIVERED,
  };
  return statuses[eventType];
}


}

