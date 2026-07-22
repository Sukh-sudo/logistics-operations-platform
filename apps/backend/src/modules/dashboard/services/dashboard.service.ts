import { BadRequestException, Injectable } from '@nestjs/common';
import {
  ContainerStatus,
  PackageStatus,
  Prisma,
  TrailerStatus,
} from '@prisma/client';

import { PrismaService } from '../../../infrastructure/prisma/prisma.service';
import { DashboardQueryDto } from '../dto/dashboard-query.dto';

@Injectable()
export class DashboardService {
  constructor(
    private readonly prisma: PrismaService,
  ) {}

  async getSummary(filters: DashboardQueryDto = {}) {
    const snapshotDate = this.getInclusiveDateRange(filters);
    const snapshotWhere = {
      ...(snapshotDate && { updatedAt: snapshotDate }),
      ...(filters.terminalId !== undefined && {
        currentTerminalId: filters.terminalId,
      }),
    };

    // A selected status leaves the other status buckets at zero while keeping
    // the response shape stable for cards and charts in the dashboard client.
    const countPackages = (currentStatus: PackageStatus) =>
      filters.packageStatus && filters.packageStatus !== currentStatus
        ? Promise.resolve(0)
        : this.prisma.packageSnapshot.count({
            where: { ...snapshotWhere, currentStatus },
          });
    const countTrailers = (currentStatus: TrailerStatus) =>
      filters.trailerStatus && filters.trailerStatus !== currentStatus
        ? Promise.resolve(0)
        : this.prisma.trailerSnapshot.count({
            where: { ...snapshotWhere, currentStatus },
          });

    const [
      received,
      sorted,
      inContainer,
      inTrailer,
      departed,
      arrived,
      outForDelivery,
      delivered,

      openContainers,
      closedContainers,
      loadedContainers,

      openTrailers,
      closedTrailers,
      inTransitTrailers,
      arrivedTrailers,
    ] = await Promise.all([
      countPackages(PackageStatus.RECEIVED),
      countPackages(PackageStatus.SORTED),
      countPackages(PackageStatus.IN_CONTAINER),
      countPackages(PackageStatus.IN_TRAILER),
      countPackages(PackageStatus.DEPARTED),
      countPackages(PackageStatus.ARRIVED),
      countPackages(PackageStatus.OUT_FOR_DELIVERY),
      countPackages(PackageStatus.DELIVERED),

      // Container counts
      this.prisma.containerSnapshot.count({
        where: {
          ...snapshotWhere,
          currentStatus: ContainerStatus.OPEN,
        },
      }),

      this.prisma.containerSnapshot.count({
        where: {
          ...snapshotWhere,
          currentStatus: ContainerStatus.CLOSED,
        },
      }),

      this.prisma.containerSnapshot.count({
        where: {
          ...snapshotWhere,
          currentStatus: ContainerStatus.OPEN,
          packageCount: {
            gt: 0,
          },
        },
      }),

      countTrailers(TrailerStatus.OPEN),
      countTrailers(TrailerStatus.CLOSED),
      countTrailers(TrailerStatus.IN_TRANSIT),
      countTrailers(TrailerStatus.ARRIVED),
    ]);

    return {
      packages: {
        received,
        sorted,
        inContainer,
        inTrailer,
        departed,
        arrived,
        outForDelivery,
        delivered,
      },

      containers: {
        open: openContainers,
        closed: closedContainers,
        loaded: loadedContainers,
      },

      trailers: {
        open: openTrailers,
        closed: closedTrailers,
        inTransit: inTransitTrailers,
        arrived: arrivedTrailers,
      },
    };
  }

  async getTrailers() {
  const trailers =
    await this.prisma.trailerSnapshot.findMany({
      orderBy: {
        trailerBarcode: 'asc',
      },
    });

  return Promise.all(
    trailers.map(async (trailer) => {
      const containerCount =
        await this.prisma.containerSnapshot.count({
          where: {
            currentTrailerId: trailer.id,
          },
        });

      const loosePackageCount =
        await this.prisma.packageSnapshot.count({
          where: {
            currentTrailerId: trailer.id,
          },
        });

      const containerIds =
        (
          await this.prisma.containerSnapshot.findMany({
            where: {
              currentTrailerId: trailer.id,
            },
            select: {
              id: true,
            },
          })
        ).map((c) => c.id);

      const containerPackageCount =
        containerIds.length > 0
          ? await this.prisma.packageSnapshot.count({
              where: {
                currentContainerId: {
                  in: containerIds,
                },
              },
            })
          : 0;

      return {
        trailerBarcode: trailer.trailerBarcode,
        status: trailer.currentStatus,
        containerCount,
        packageCount:
          loosePackageCount + containerPackageCount,
      };
    }),
  );
}

// Returns all containers for the operations dashboard
async getContainers() {
  // Fetch all container snapshots
  const containers =
    await this.prisma.containerSnapshot.findMany({
      orderBy: {
        containerBarcode: 'asc',
      },
    });

  return Promise.all(
    containers.map(async (container) => {
      let assignedTrailer: string | null = null;

      // If the container is assigned to a trailer,
      // retrieve the trailer barcode.
      if (container.currentTrailerId) {
        const trailer =
          await this.prisma.trailerSnapshot.findUnique({
            where: {
              id: container.currentTrailerId,
            },
            select: {
              trailerBarcode: true,
            },
          });

        assignedTrailer =
          trailer?.trailerBarcode ?? null;
      }

      return {
        containerBarcode: container.containerBarcode,
        status: container.currentStatus,
        packageCount: container.packageCount,
        assignedTrailer,
      };
    }),
  );
}

// Returns the most recent operational events across the system
// Returns the most recent activity across packages, containers and trailers
async getRecentEvents(filters: DashboardQueryDto = {}, limit = 25) {
  const eventDate = this.getInclusiveDateRange(filters);
  const packageSnapshotWhere: Prisma.PackageSnapshotWhereInput = {
    ...(filters.terminalId !== undefined && {
      currentTerminalId: filters.terminalId,
    }),
    ...(filters.packageStatus && { currentStatus: filters.packageStatus }),
  };
  const containerSnapshotWhere: Prisma.ContainerSnapshotWhereInput = {
    ...(filters.terminalId !== undefined && {
      currentTerminalId: filters.terminalId,
    }),
  };
  const trailerSnapshotWhere: Prisma.TrailerSnapshotWhereInput = {
    ...(filters.terminalId !== undefined && {
      currentTerminalId: filters.terminalId,
    }),
    ...(filters.trailerStatus && { currentStatus: filters.trailerStatus }),
  };

  // Get the latest package events
  const packageEvents =
    await this.prisma.packageEvent.findMany({
      where: {
        ...(eventDate && { createdAt: eventDate }),
        ...(Object.keys(packageSnapshotWhere).length > 0 && {
          package: packageSnapshotWhere,
        }),
      },
      take: limit,
      orderBy: {
        createdAt: 'desc',
      },
      include: {
        package: {
          select: {
            trackingNumber: true,
          },
        },
      },
    });

  // Get the latest container events
  const containerEvents =
    await this.prisma.containerEvent.findMany({
      where: {
        ...(eventDate && { createdAt: eventDate }),
        ...(Object.keys(containerSnapshotWhere).length > 0 && {
          container: containerSnapshotWhere,
        }),
      },
      take: limit,
      orderBy: {
        createdAt: 'desc',
      },
      include: {
        container: {
          select: {
            containerBarcode: true,
          },
        },
      },
    });

  // Get the latest trailer events
  const trailerEvents =
    await this.prisma.trailerEvent.findMany({
      where: {
        ...(eventDate && { createdAt: eventDate }),
        ...(Object.keys(trailerSnapshotWhere).length > 0 && {
          trailer: trailerSnapshotWhere,
        }),
      },
      take: limit,
      orderBy: {
        createdAt: 'desc',
      },
      include: {
        trailer: {
          select: {
            trailerBarcode: true,
          },
        },
      },
    });

  // Combine everything into one timeline
  const events = [
    ...packageEvents.map((event) => ({
      assetType: 'PACKAGE',
      reference: event.package.trackingNumber,
      event: event.eventType,
      occurredAt: event.createdAt,
    })),

    ...containerEvents.map((event) => ({
      assetType: 'CONTAINER',
      reference: event.container.containerBarcode,
      event: event.eventType,
      occurredAt: event.createdAt,
    })),

    ...trailerEvents.map((event) => ({
      assetType: 'TRAILER',
      reference: event.trailer.trailerBarcode,
      event: event.eventType,
      occurredAt: event.createdAt,
    })),
  ];

  // Return the newest events first
  return events
    .sort(
      (a, b) =>
        b.occurredAt.getTime() -
        a.occurredAt.getTime(),
    )
    .slice(0, limit);
}

/**
 * Converts calendar-date filters to a half-open UTC range. Using the next
 * day's midnight for `lt` keeps the selected end date inclusive.
 */
private getInclusiveDateRange(
  filters: Pick<DashboardQueryDto, 'fromDate' | 'toDate'>,
): Prisma.DateTimeFilter | undefined {
  if (filters.fromDate && filters.toDate && filters.fromDate > filters.toDate) {
    throw new BadRequestException('fromDate must be on or before toDate');
  }

  if (!filters.fromDate && !filters.toDate) {
    return undefined;
  }

  const range: Prisma.DateTimeFilter = {};
  if (filters.fromDate) {
    range.gte = new Date(`${filters.fromDate}T00:00:00.000Z`);
  }
  if (filters.toDate) {
    const exclusiveEnd = new Date(`${filters.toDate}T00:00:00.000Z`);
    exclusiveEnd.setUTCDate(exclusiveEnd.getUTCDate() + 1);
    range.lt = exclusiveEnd;
  }
  return range;
}

// Returns all packages with their current operational location
async getPackages() {
  const packages =
    await this.prisma.packageSnapshot.findMany({
      orderBy: {
        trackingNumber: 'asc',
      },
    });

  return Promise.all(
    packages.map(async (pkg) => {
      let containerBarcode: string | null = null;
      let trailerBarcode: string | null = null;

      // Resolve the container barcode
      if (pkg.currentContainerId) {
        const container =
          await this.prisma.containerSnapshot.findUnique({
            where: {
              id: pkg.currentContainerId,
            },
            select: {
              containerBarcode: true,
              currentTrailerId: true,
            },
          });

        if (container) {
          containerBarcode = container.containerBarcode;

          // Resolve the trailer through the container
          if (container.currentTrailerId) {
            const trailer =
              await this.prisma.trailerSnapshot.findUnique({
                where: {
                  id: container.currentTrailerId,
                },
                select: {
                  trailerBarcode: true,
                },
              });

            trailerBarcode =
              trailer?.trailerBarcode ?? null;
          }
        }
      }

      // Package loaded directly onto trailer
      if (
        !trailerBarcode &&
        pkg.currentTrailerId
      ) {
        const trailer =
          await this.prisma.trailerSnapshot.findUnique({
            where: {
              id: pkg.currentTrailerId,
            },
            select: {
              trailerBarcode: true,
            },
          });

        trailerBarcode =
          trailer?.trailerBarcode ?? null;
      }

      return {
        trackingNumber: pkg.trackingNumber,
        status: pkg.currentStatus,
        containerBarcode,
        trailerBarcode,
      };
    }),
  );
}

}
