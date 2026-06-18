import { Injectable } from '@nestjs/common';
import { ContainerStatus, PackageStatus, TrailerStatus,} from '@prisma/client';

import { PrismaService } from '../../../infrastructure/prisma/prisma.service';

@Injectable()
export class DashboardService {
  constructor(
    private readonly prisma: PrismaService,
  ) {}

  async getSummary() {
    const [
      received,
      sorted,
      inContainer,
      inTrailer,
      delivered,

      openContainers,
      closedContainers,
      loadedContainers,

      openTrailers,
      inTransitTrailers,
      arrivedTrailers,
    ] = await Promise.all([
      // Package counts
      this.prisma.packageSnapshot.count({
        where: {
          currentStatus: PackageStatus.RECEIVED,
        },
      }),

      this.prisma.packageSnapshot.count({
        where: {
          currentStatus: PackageStatus.SORTED,
        },
      }),

      this.prisma.packageSnapshot.count({
        where: {
          currentStatus: PackageStatus.IN_CONTAINER,
        },
      }),

      this.prisma.packageSnapshot.count({
        where: {
          currentStatus: PackageStatus.IN_TRAILER,
        },
      }),

      this.prisma.packageSnapshot.count({
        where: {
          currentStatus: PackageStatus.DELIVERED,
        },
      }),

      // Container counts
      this.prisma.containerSnapshot.count({
        where: {
          currentStatus: ContainerStatus.OPEN,
        },
      }),

      this.prisma.containerSnapshot.count({
        where: {
          currentStatus: ContainerStatus.CLOSED,
        },
      }),

      this.prisma.containerSnapshot.count({
        where: {
          currentStatus: ContainerStatus.OPEN,
          packageCount: {
            gt: 0,
          },
        },
      }),

      // Trailer counts
      this.prisma.trailerSnapshot.count({
        where: {
          currentStatus: TrailerStatus.OPEN,
        },
      }),

      this.prisma.trailerSnapshot.count({
        where: {
          currentStatus: TrailerStatus.IN_TRANSIT,
        },
      }),

      this.prisma.trailerSnapshot.count({
        where: {
          currentStatus: TrailerStatus.ARRIVED,
        },
      }),
    ]);

    return {
      packages: {
        received,
        sorted,
        inContainer,
        inTrailer,
        delivered,
      },

      containers: {
        open: openContainers,
        closed: closedContainers,
        loaded: loadedContainers,
      },

      trailers: {
        open: openTrailers,
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
async getRecentEvents(limit = 25) {
  // Get the latest package events
  const packageEvents =
    await this.prisma.packageEvent.findMany({
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