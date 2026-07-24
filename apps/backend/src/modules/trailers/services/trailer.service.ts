import { Injectable, NotFoundException, BadRequestException, } from '@nestjs/common';

import {
  ContainerEventType,
  PackageEventType,
  PackageStatus,
  TerminalEventType,
  TerminalStatus,
  TrailerEventType,
  TrailerStatus,
} from '@prisma/client';
import { randomUUID } from 'crypto';

import { PrismaService } from '../../../infrastructure/prisma/prisma.service';

import { CreateTrailerDto } from '../dto/create-trailer.dto';

import { LoadContainerDto } from '../dto/load-container.dto';
import { UnloadContainerDto } from '../dto/unload-container.dto';
import { LoadPackageDto } from '../dto/load-package.dto';
import { UnloadPackageDto } from '../dto/unload-package.dto';
import { PackageService } from '../../packages/services/package.service';

@Injectable()
export class TrailerService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly packages: PackageService,
  ) {}

  async createTrailer(
    dto: CreateTrailerDto,
    requestId?: string,
  ) {
    const correlationId = requestId ?? randomUUID();
    return this.prisma.$transaction(async (tx) => {
      const terminal = await tx.terminal.findUnique({
        where: { id: dto.terminalId },
        include: { snapshot: true },
      });
      if (!terminal?.snapshot) {
        throw new NotFoundException('Terminal not found');
      }
      if (terminal.snapshot.currentStatus === TerminalStatus.CLOSED) {
        throw new BadRequestException('Closed terminals cannot create trailers');
      }
      const aggregate = await tx.trailer.create({
        data: { trailerBarcode: dto.trailerBarcode },
      });

      // Create trailer snapshot
      const snapshot =
        await tx.trailerSnapshot.create({
          data: {
            id: aggregate.id,
            trailerBarcode: dto.trailerBarcode,
            currentStatus: TrailerStatus.OPEN,
            currentTerminalId: dto.terminalId,
          },
        });

      // Create creation event
      const event =
        await tx.trailerEvent.create({
          data: {
            trailerId: snapshot.id,
            eventType:
              TrailerEventType.TRAILER_CREATED,
            correlationId,
            metadata: { terminalId: dto.terminalId },
          },
        });

      const terminalEvent = await tx.terminalEvent.create({
        data: {
          terminalId: dto.terminalId,
          eventType: TerminalEventType.TRAILER_ARRIVED,
          correlationId,
          payload: {
            trailerId: snapshot.id,
            trailerBarcode: snapshot.trailerBarcode,
            reason: 'CREATED',
          },
        },
      });
      await tx.terminalSnapshot.update({
        where: { terminalId: dto.terminalId },
        data: {
          trailerCount: { increment: 1 },
          lastActivityAt: terminalEvent.createdAt,
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
  requestId?: string,
) {
  const correlationId = requestId ?? randomUUID();
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
      if (
        trailer.currentTerminalId === null ||
        container.currentTerminalId !== trailer.currentTerminalId
      ) {
        throw new BadRequestException(
          'Container and trailer must be owned by the same terminal',
        );
      }
      
      await tx.trailerEvent.create({
  data: {
    trailerId,
    eventType:
      TrailerEventType.CONTAINER_LOADED_TO_TRAILER,
    correlationId,
    metadata: {
      containerId: container.id,
      containerBarcode: container.containerBarcode,
    },
  },
});
      await tx.containerEvent.create({
        data: {
          containerId: container.id,
          eventType: ContainerEventType.CONTAINER_LOADED_TO_TRAILER,
          correlationId,
          metadata: {
            trailerId,
            trailerBarcode: trailer.trailerBarcode,
          },
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
  requestId?: string,
) {
  const correlationId = requestId ?? randomUUID();
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
    correlationId,
    metadata: {
      containerId: container.id,
      containerBarcode: container.containerBarcode,
    },
  },
});
      await tx.containerEvent.create({
        data: {
          containerId: container.id,
          eventType: ContainerEventType.CONTAINER_UNLOADED_FROM_TRAILER,
          correlationId,
          metadata: {
            trailerId,
            trailerBarcode: trailer.trailerBarcode,
          },
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
  requestId?: string,
) {
  const correlationId = requestId ?? randomUUID();
  const result = await this.prisma.$transaction(
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
      if (
        trailer.currentTerminalId === null ||
        packageSnapshot.currentTerminalId !== trailer.currentTerminalId
      ) {
        throw new BadRequestException(
          'Package and trailer must be owned by the same terminal',
        );
      }

      await tx.packageTrailerHistory.create({
        data: {
          packageId: packageSnapshot.id,
          trailerId,
        },
      });

      const packageEvent = await tx.packageEvent.create({
        data: {
          packageId: packageSnapshot.id,
          eventType:
            PackageEventType.PACKAGE_LOADED_TO_TRAILER,
          terminalId: trailer.currentTerminalId,
          correlationId,
          metadata: { trailerId, trailerBarcode: trailer.trailerBarcode },
        },
      });
      await tx.packageProjectionOutbox.create({
        data: { packageEventId: packageEvent.id },
      });
      await tx.trailerEvent.create({
        data: {
          trailerId,
          eventType: TrailerEventType.PACKAGE_LOADED_TO_TRAILER,
          correlationId,
          metadata: {
            packageId: packageSnapshot.id,
            trackingNumber: packageSnapshot.trackingNumber,
          },
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
        packageEventId: packageEvent.id,
      };
    },
  );
  await this.packages.processProjection(result.packageEventId);
  return result;
}

async unloadPackage(
  trailerId: string,
  dto: UnloadPackageDto,
  requestId?: string,
) {
  const correlationId = requestId ?? randomUUID();
  const result = await this.prisma.$transaction(
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

      const packageEvent = await tx.packageEvent.create({
        data: {
          packageId: packageSnapshot.id,
          eventType:
            PackageEventType.PACKAGE_UNLOADED_FROM_TRAILER,
          terminalId: trailer.currentTerminalId,
          correlationId,
          metadata: { trailerId, trailerBarcode: trailer.trailerBarcode },
        },
      });
      await tx.packageProjectionOutbox.create({
        data: { packageEventId: packageEvent.id },
      });
      await tx.trailerEvent.create({
        data: {
          trailerId,
          eventType: TrailerEventType.PACKAGE_UNLOADED_FROM_TRAILER,
          correlationId,
          metadata: {
            packageId: packageSnapshot.id,
            trackingNumber: packageSnapshot.trackingNumber,
          },
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
        packageEventId: packageEvent.id,
      };
    },
  );
  await this.packages.processProjection(result.packageEventId);
  return result;
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
  const snapshot = await this.prisma.trailerSnapshot.findUnique({
    where: { trailerBarcode },
  });

  if (!snapshot) {
    throw new NotFoundException(
      'Trailer not found',
    );
  }

  return this.prisma.trailerEvent.findMany({
    where: { trailerId: snapshot.id },
    orderBy: { createdAt: 'asc' },
  });
}

async getTrailerContainers(
  trailerBarcode: string,
) {
  const trailer =
    await this.prisma.trailerSnapshot.findUnique({
      where: {
        trailerBarcode,
      },
    });

  if (!trailer) {
    throw new NotFoundException(
      'Trailer not found',
    );
  }

  const containers =
    await this.prisma.containerSnapshot.findMany({
      where: {
        currentTrailerId: trailer.id,
      },
      orderBy: {
        containerBarcode: 'asc',
      },
    });

  return {
    trailerBarcode,
    containerCount: containers.length,
    containers,
  };
}

async getTrailerPackages(
  trailerBarcode: string,
) {
  // Find trailer
  const trailer =
    await this.prisma.trailerSnapshot.findUnique({
      where: {
        trailerBarcode,
      },
    });

  if (!trailer) {
    throw new NotFoundException(
      'Trailer not found',
    );
  }

  // Find all containers currently on the trailer
  const containers =
    await this.prisma.containerSnapshot.findMany({
      where: {
        currentTrailerId: trailer.id,
      },
    });

  const containerIds = containers.map(
    (container) => container.id,
  );

  const containerLookup = new Map(
    containers.map((container) => [
      container.id,
      container.containerBarcode,
    ]),
  );

  // Packages inside containers
  const containerPackages =
    await this.prisma.packageSnapshot.findMany({
      where: {
        currentContainerId: {
          in: containerIds.length
            ? containerIds
            : [''],
        },
      },
      orderBy: {
        trackingNumber: 'asc',
      },
    });

  // Loose packages on trailer
  const loosePackages =
    await this.prisma.packageSnapshot.findMany({
      where: {
        currentTrailerId: trailer.id,
      },
      orderBy: {
        trackingNumber: 'asc',
      },
    });

  const packages = [
    ...containerPackages.map((pkg) => ({
      trackingNumber: pkg.trackingNumber,
      currentStatus: pkg.currentStatus,
      location: 'CONTAINER',
      containerBarcode:
        containerLookup.get(
          pkg.currentContainerId!,
        ) ?? null,
    })),

    ...loosePackages.map((pkg) => ({
      trackingNumber: pkg.trackingNumber,
      currentStatus: pkg.currentStatus,
      location: 'LOOSE',
      containerBarcode: null,
    })),
  ];

  return {
    trailerBarcode,
    packageCount: packages.length,
    packages,
  };
}


}
