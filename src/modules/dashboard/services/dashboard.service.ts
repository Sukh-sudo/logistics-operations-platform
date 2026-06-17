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


}