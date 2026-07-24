import { Injectable } from '@nestjs/common';
import {
  ContainerEventType,
  ContainerStatus,
  PackageEventType,
  PackageStatus,
  Prisma,
  TrailerEventType,
  TrailerStatus,
} from '@prisma/client';

import { PrismaService } from '../../../infrastructure/prisma/prisma.service';

type Tx = Prisma.TransactionClient;

/**
 * Reconstructs disposable read models from immutable business events and
 * immutable relationship history. Aggregate rows retain identity while the
 * snapshots are removed and recreated in the same transaction.
 */
@Injectable()
export class SnapshotRebuildService {
  constructor(private readonly prisma: PrismaService) {}

  rebuildAll() {
    return this.prisma.$transaction(async (tx) => {
      const packages = await tx.package.findMany({
        include: { events: { orderBy: { createdAt: 'asc' } } },
      });
      const containers = await tx.container.findMany({
        include: { events: { orderBy: { createdAt: 'asc' } } },
      });
      const trailers = await tx.trailer.findMany({
        include: { events: { orderBy: { createdAt: 'asc' } } },
      });

      await tx.packageSnapshot.deleteMany();
      await tx.containerSnapshot.deleteMany();
      await tx.trailerSnapshot.deleteMany();

      for (const aggregate of packages) {
        await this.rebuildPackage(tx, aggregate);
      }
      for (const aggregate of containers) {
        await this.rebuildContainer(tx, aggregate);
      }
      for (const aggregate of trailers) {
        await this.rebuildTrailer(tx, aggregate);
      }

      return {
        packages: packages.length,
        containers: containers.length,
        trailers: trailers.length,
      };
    });
  }

  private async rebuildPackage(
    tx: Tx,
    aggregate: Prisma.PackageGetPayload<{
      include: { events: true };
    }>,
  ) {
    const latest = aggregate.events.at(-1);
    const activeContainer = await tx.packageContainerHistory.findFirst({
      where: { packageId: aggregate.id, unloadedAt: null },
      orderBy: { loadedAt: 'desc' },
    });
    const activeTrailer = await tx.packageTrailerHistory.findFirst({
      where: { packageId: aggregate.id, unloadedAt: null },
      orderBy: { loadedAt: 'desc' },
    });

    return tx.packageSnapshot.create({
      data: {
        id: aggregate.id,
        trackingNumber: aggregate.trackingNumber,
        packageType: aggregate.packageType,
        currentStatus: latest
          ? this.packageStatus(latest.eventType)
          : PackageStatus.RECEIVED,
        currentTerminalId: this.eventTerminalId(latest?.metadata, latest?.terminalId),
        currentContainerId: activeContainer?.containerId ?? null,
        currentTrailerId: activeTrailer?.trailerId ?? null,
      },
    });
  }

  private async rebuildContainer(
    tx: Tx,
    aggregate: Prisma.ContainerGetPayload<{
      include: { events: true };
    }>,
  ) {
    const activeTrailer = await tx.containerTrailerHistory.findFirst({
      where: { containerId: aggregate.id, unloadedAt: null },
      orderBy: { loadedAt: 'desc' },
    });
    const packageCount = await tx.packageContainerHistory.count({
      where: { containerId: aggregate.id, unloadedAt: null },
    });
    const created = aggregate.events.find(
      (event) => event.eventType === ContainerEventType.CONTAINER_CREATED,
    );
    const latest = aggregate.events.at(-1);

    return tx.containerSnapshot.create({
      data: {
        id: aggregate.id,
        containerBarcode: aggregate.containerBarcode,
        packageType: aggregate.packageType,
        currentStatus: this.containerStatus(latest?.eventType),
        currentTerminalId: this.eventTerminalId(
          latest?.metadata,
          this.metadataNumber(created?.metadata, 'terminalId'),
        ),
        currentTrailerId: activeTrailer?.trailerId ?? null,
        packageCount,
      },
    });
  }

  private async rebuildTrailer(
    tx: Tx,
    aggregate: Prisma.TrailerGetPayload<{
      include: { events: true };
    }>,
  ) {
    const containerCount = await tx.containerTrailerHistory.count({
      where: { trailerId: aggregate.id, unloadedAt: null },
    });
    const packageCount = await tx.packageTrailerHistory.count({
      where: { trailerId: aggregate.id, unloadedAt: null },
    });
    const created = aggregate.events.find(
      (event) => event.eventType === TrailerEventType.TRAILER_CREATED,
    );
    const latest = aggregate.events.at(-1);

    return tx.trailerSnapshot.create({
      data: {
        id: aggregate.id,
        trailerBarcode: aggregate.trailerBarcode,
        currentStatus: this.trailerStatus(latest?.eventType),
        currentTerminalId: this.eventTerminalId(
          latest?.metadata,
          this.metadataNumber(created?.metadata, 'terminalId'),
        ),
        containerCount,
        packageCount,
      },
    });
  }

  private packageStatus(eventType: PackageEventType): PackageStatus {
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

  private containerStatus(eventType?: ContainerEventType): ContainerStatus {
    if (eventType === ContainerEventType.CONTAINER_DEPARTED) {
      return ContainerStatus.IN_TRANSIT;
    }
    if (eventType === ContainerEventType.CONTAINER_ARRIVED) {
      return ContainerStatus.ARRIVED;
    }
    if (eventType === ContainerEventType.CONTAINER_CLOSED) {
      return ContainerStatus.CLOSED;
    }
    return ContainerStatus.OPEN;
  }

  private trailerStatus(eventType?: TrailerEventType): TrailerStatus {
    if (eventType === TrailerEventType.TRAILER_DEPARTED) {
      return TrailerStatus.IN_TRANSIT;
    }
    if (eventType === TrailerEventType.TRAILER_ARRIVED) {
      return TrailerStatus.ARRIVED;
    }
    if (eventType === TrailerEventType.TRAILER_CLOSED) {
      return TrailerStatus.CLOSED;
    }
    return TrailerStatus.OPEN;
  }

  private metadataNumber(
    metadata: Prisma.JsonValue | null | undefined,
    key: string,
  ) {
    if (
      metadata &&
      typeof metadata === 'object' &&
      !Array.isArray(metadata) &&
      typeof metadata[key] === 'number'
    ) {
      return metadata[key];
    }
    return null;
  }

  /**
   * Event metadata may intentionally contain a null terminal while freight is
   * in transit. Presence of the key therefore matters more than nullish
   * fallback semantics when a snapshot is rebuilt.
   */
  private eventTerminalId(
    metadata: Prisma.JsonValue | null | undefined,
    fallback: number | null | undefined,
  ) {
    if (
      metadata &&
      typeof metadata === 'object' &&
      !Array.isArray(metadata) &&
      Object.prototype.hasOwnProperty.call(metadata, 'currentTerminalId')
    ) {
      return typeof metadata.currentTerminalId === 'number'
        ? metadata.currentTerminalId
        : null;
    }
    if (
      metadata &&
      typeof metadata === 'object' &&
      !Array.isArray(metadata) &&
      Object.prototype.hasOwnProperty.call(metadata, 'terminalId')
    ) {
      return typeof metadata.terminalId === 'number'
        ? metadata.terminalId
        : null;
    }
    return fallback ?? null;
  }
}
