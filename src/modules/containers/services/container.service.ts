
import {ContainerEventType, ContainerStatus, PackageStatus,} from '@prisma/client';
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
}