
import {ContainerEventType, ContainerStatus, PackageStatus, PackageEventType,} from '@prisma/client';
import { LoadPackageDto } from '../dto/load-package.dto';
import { PrismaService } from '../../../infrastructure/prisma/prisma.service';
import { CreateContainerDto } from '../dto/create-container.dto';
import {Injectable, ConflictException, BadRequestException, NotFoundException,} from '@nestjs/common';

@Injectable()
export class ContainerService {
  constructor(
    // Database access layer
    private readonly prisma: PrismaService,
  ) {}

  async createContainer(dto: CreateContainerDto,) {

  const existing =
    await this.prisma.containerSnapshot.findUnique({
      where: {
        containerBarcode: dto.containerBarcode,
      },
    });

  if (existing) {
    throw new ConflictException(
      'Container already exists',
    );
  }

  return this.prisma.$transaction(async (tx) => {

      // Create container snapshot
      const snapshot =
        await tx.containerSnapshot.create({
          data: {
            containerBarcode: dto.containerBarcode,
            currentStatus: ContainerStatus.OPEN,
          },
        });

      // Create immutable creation event
      const event =
        await tx.containerEvent.create({
          data: {
            containerId: snapshot.id,
            eventType:
              ContainerEventType.CONTAINER_CREATED,
          },
        });

      return {
        snapshot,
        event,
      };
    });
  }

    async loadPackage(
    containerId: string,
    dto: LoadPackageDto,
    ) {
    return this.prisma.$transaction(async (tx) => {

        const container =
        await tx.containerSnapshot.findUnique({
            where: {
            id: containerId,
            },
        });

        if (!container) {
        throw new NotFoundException(
            'Container not found',
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

        if (packageSnapshot.currentContainerId) {
        throw new BadRequestException(
            'Package already assigned to a container',
        );
        }

        await tx.packageEvent.create({
        data: {
            packageId: packageSnapshot.id,
            eventType:
            PackageEventType.PACKAGE_LOADED_TO_CONTAINER,
        },
        });
        await tx.packageContainerHistory.create({
        data: {
            packageId: packageSnapshot.id,
            containerId,
        },
        });

        await tx.packageSnapshot.update({
        where: {
            id: packageSnapshot.id,
        },
        data: {
            currentContainerId: containerId,
            currentStatus: PackageStatus.IN_CONTAINER,
        },
        });

        await tx.containerSnapshot.update({
        where: {
            id: containerId,
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
        containerId,
        };
    });
    }

    async unloadPackage(
  containerId: string,
  dto: LoadPackageDto,
) {
  return this.prisma.$transaction(async (tx) => {

    // Verify container exists
    const container =
      await tx.containerSnapshot.findUnique({
        where: {
          id: containerId,
        },
      });

    if (!container) {
      throw new NotFoundException(
        'Container not found',
      );
    }

    // Find package
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

    // Verify package belongs to this container
    if (
      packageSnapshot.currentContainerId !==
      containerId
    ) {
      throw new BadRequestException(
        'Package is not assigned to this container',
      );
    }
    
    await tx.packageEvent.create({
  data: {
    packageId: packageSnapshot.id,
    eventType:
      PackageEventType.PACKAGE_UNLOADED_FROM_CONTAINER,
  },
});
    // Close active history record
    await tx.packageContainerHistory.updateMany({
      where: {
        packageId: packageSnapshot.id,
        containerId,
        unloadedAt: null,
      },
      data: {
        unloadedAt: new Date(),
      },
    });

    // Remove package from container
    await tx.packageSnapshot.update({
      where: {
        id: packageSnapshot.id,
      },
      data: {
        currentContainerId: null,
        currentStatus: PackageStatus.SORTED,
      },
    });

    // Decrement container count
    await tx.containerSnapshot.update({
      where: {
        id: containerId,
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
      containerId,
    };
  });
} 

async getContainer(
  containerBarcode: string,
) {
  const snapshot =
    await this.prisma.containerSnapshot.findUnique({
      where: { containerBarcode },
    });

  if (!snapshot) {
    throw new NotFoundException(
      'Container not found',
    );
  }

  return snapshot;
}

async getContainerHistory(
  containerBarcode: string,
) {
  const snapshot =
    await this.prisma.containerSnapshot.findUnique({
      where: { containerBarcode },
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
      'Container not found',
    );
  }

  return snapshot.events;
}


}