import { Injectable, NotFoundException, BadRequestException, } from '@nestjs/common';

import {TrailerEventType, TrailerStatus,PackageEventType, PackageStatus,} from '@prisma/client';

import { PrismaService } from '../../../infrastructure/prisma/prisma.service';

import { CreateTrailerDto } from '../dto/create-trailer.dto';

import { LoadContainerDto } from '../dto/load-container.dto';
import { UnloadContainerDto } from '../dto/unload-container.dto';
import { LoadPackageDto } from '../dto/load-package.dto';
import { UnloadPackageDto } from '../dto/unload-package.dto';

@Injectable()
export class TrailerService {
  constructor(
    private readonly prisma: PrismaService,
  ) {}

  async createTrailer(
    dto: CreateTrailerDto,
  ) {
    return this.prisma.$transaction(async (tx) => {

      // Create trailer snapshot
      const snapshot =
        await tx.trailerSnapshot.create({
          data: {
            trailerBarcode: dto.trailerBarcode,
            currentStatus: TrailerStatus.OPEN,
          },
        });

      // Create creation event
      const event =
        await tx.trailerEvent.create({
          data: {
            trailerId: snapshot.id,
            eventType:
              TrailerEventType.TRAILER_CREATED,
          },
        });

      return {
        snapshot,
        event,
      };
    });
  }

  async loadContainer(
  trailerId: string,
  dto: LoadContainerDto,
) {
  return this.prisma.$transaction(
    async (tx) => {

      const trailer =
        await tx.trailerSnapshot.findUnique({
          where: { id: trailerId },
        });

      if (!trailer) {
        throw new NotFoundException(
          'Trailer not found',
        );
      }

      const container =
        await tx.containerSnapshot.findUnique({
          where: {
            containerBarcode:
              dto.containerBarcode,
          },
        });

      if (!container) {
        throw new NotFoundException(
          'Container not found',
        );
      }

      if (container.currentTrailerId) {
        throw new BadRequestException(
            'Container already assigned to a trailer',
        );
      }
      
      await tx.trailerEvent.create({
  data: {
    trailerId,
    eventType:
      TrailerEventType.CONTAINER_LOADED_TO_TRAILER,
  },
});
      await tx.containerTrailerHistory.create({
        data: {
          containerId: container.id,
          trailerId,
        },
      });

      await tx.containerSnapshot.update({
        where: {
          id: container.id,
        },
        data: {
          currentTrailerId: trailerId,
        },
      });

      await tx.trailerSnapshot.update({
        where: {
          id: trailerId,
        },
        data: {
          containerCount: {
            increment: 1,
          },
        },
      });

      return {
        success: true,
        trailerId,
        containerId: container.id,
      };
    },
  );
}

async unloadContainer(
  trailerId: string,
  dto: UnloadContainerDto,
) {
  return this.prisma.$transaction(
    async (tx) => {

      const trailer =
        await tx.trailerSnapshot.findUnique({
          where: { id: trailerId },
        });

      if (!trailer) {
        throw new NotFoundException(
          'Trailer not found',
        );
      }

      const container =
        await tx.containerSnapshot.findUnique({
          where: {
            containerBarcode:
              dto.containerBarcode,
          },
        });

      if (!container) {
        throw new NotFoundException(
          'Container not found',
        );
      }

      if (
        container.currentTrailerId !== trailerId
      ) {
        throw new BadRequestException(
          'Container is not assigned to this trailer',
        );
      }

      await tx.trailerEvent.create({
  data: {
    trailerId,
    eventType:
      TrailerEventType.CONTAINER_UNLOADED_FROM_TRAILER,
  },
});

      await tx.containerTrailerHistory.updateMany({
        where: {
          containerId: container.id,
          trailerId,
          unloadedAt: null,
        },
        data: {
          unloadedAt: new Date(),
        },
      });

      await tx.containerSnapshot.update({
        where: {
          id: container.id,
        },
        data: {
          currentTrailerId: null,
        },
      });

      await tx.trailerSnapshot.update({
        where: {
          id: trailerId,
        },
        data: {
          containerCount: {
            decrement: 1,
          },
        },
      });

      return {
        success: true,
        trailerId,
        containerId: container.id,
      };
    },
  );
}

async loadPackage(
  trailerId: string,
  dto: LoadPackageDto,
) {
  return this.prisma.$transaction(
    async (tx) => {

      const trailer =
        await tx.trailerSnapshot.findUnique({
          where: { id: trailerId },
        });

      if (!trailer) {
        throw new NotFoundException(
          'Trailer not found',
        );
      }

      const packageSnapshot =
        await tx.packageSnapshot.findUnique({
          where: {
            trackingNumber: dto.trackingNumber,
          },
        });

      if (!packageSnapshot) {
        throw new NotFoundException(
          'Package not found',
        );
      }

      if (packageSnapshot.currentTrailerId) {
        throw new BadRequestException(
          'Package already assigned to a trailer',
        );
      }

      await tx.packageTrailerHistory.create({
        data: {
          packageId: packageSnapshot.id,
          trailerId,
        },
      });

      await tx.packageEvent.create({
        data: {
          packageId: packageSnapshot.id,
          eventType:
            PackageEventType.PACKAGE_LOADED_TO_TRAILER,
        },
      });

      await tx.packageSnapshot.update({
        where: {
          id: packageSnapshot.id,
        },
        data: {
          currentTrailerId: trailerId,
          currentStatus: PackageStatus.IN_TRAILER,
        },
      });

      await tx.trailerSnapshot.update({
        where: {
          id: trailerId,
        },
        data: {
          packageCount: {
            increment: 1,
          },
        },
      });

      return {
        success: true,
        packageId: packageSnapshot.id,
        trailerId,
      };
    },
  );
}

async unloadPackage(
  trailerId: string,
  dto: UnloadPackageDto,
) {
  return this.prisma.$transaction(
    async (tx) => {

      const trailer =
        await tx.trailerSnapshot.findUnique({
          where: { id: trailerId },
        });

      if (!trailer) {
        throw new NotFoundException(
          'Trailer not found',
        );
      }

      const packageSnapshot =
        await tx.packageSnapshot.findUnique({
          where: {
            trackingNumber: dto.trackingNumber,
          },
        });

      if (!packageSnapshot) {
        throw new NotFoundException(
          'Package not found',
        );
      }

      if (
        packageSnapshot.currentTrailerId !==
        trailerId
      ) {
        throw new BadRequestException(
          'Package is not assigned to this trailer',
        );
      }

      await tx.packageTrailerHistory.updateMany({
        where: {
          packageId: packageSnapshot.id,
          trailerId,
          unloadedAt: null,
        },
        data: {
          unloadedAt: new Date(),
        },
      });

      await tx.packageEvent.create({
        data: {
          packageId: packageSnapshot.id,
          eventType:
            PackageEventType.PACKAGE_UNLOADED_FROM_TRAILER,
        },
      });

      await tx.packageSnapshot.update({
        where: {
          id: packageSnapshot.id,
        },
        data: {
          currentTrailerId: null,
          currentStatus: PackageStatus.ARRIVED,
        },
      });

      await tx.trailerSnapshot.update({
        where: {
          id: trailerId,
        },
        data: {
          packageCount: {
            decrement: 1,
          },
        },
      });

      return {
        success: true,
        packageId: packageSnapshot.id,
        trailerId,
      };
    },
  );
}

async getTrailer(
  trailerBarcode: string,
) {
  const snapshot =
    await this.prisma.trailerSnapshot.findUnique({
      where: { trailerBarcode },
    });

  if (!snapshot) {
    throw new NotFoundException(
      'Trailer not found',
    );
  }

  return snapshot;
}

async getTrailerHistory(
  trailerBarcode: string,
) {
  const snapshot =
    await this.prisma.trailerSnapshot.findUnique({
      where: { trailerBarcode },
      include: {
        events: {
          orderBy: {
            createdAt: 'asc',
          },
        },
      },
    });

  if (!snapshot) {
    throw new NotFoundException(
      'Trailer not found',
    );
  }

  return snapshot.events;
}


}