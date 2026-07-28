
import {
  ContainerEventType,
  ContainerStatus,
  PackageEventType,
  PackageStatus,
  TerminalEventType,
  TerminalStatus,
} from '@prisma/client';
import { randomUUID } from 'crypto';
import { LoadPackageDto } from '../dto/load-package.dto';
import { PrismaService } from '../../../infrastructure/prisma/prisma.service';
import { CreateContainerDto } from '../dto/create-container.dto';
import {Injectable, ConflictException, BadRequestException, NotFoundException,} from '@nestjs/common';
import { packageTypeFromIdentifier } from '../../../common/domain/asset-identifiers';
import { PackageService } from '../../packages/services/package.service';
import type { TransactionHook } from '../../../common/domain/transaction-hook';

@Injectable()
export class ContainerService {
  constructor(
    // Database access layer
    private readonly prisma: PrismaService,
    private readonly packages: PackageService,
  ) {}

  async createContainer(dto: CreateContainerDto, requestId?: string) {
  const correlationId = requestId ?? randomUUID();

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
      const terminal = await tx.terminal.findUnique({
        where: { id: dto.terminalId },
        include: { snapshot: true },
      });
      if (!terminal?.snapshot) {
        throw new NotFoundException('Terminal not found');
      }
      if (terminal.snapshot.currentStatus === TerminalStatus.CLOSED) {
        throw new BadRequestException('Closed terminals cannot create containers');
      }
      const packageType = packageTypeFromIdentifier(dto.containerBarcode);
      const aggregate = await tx.container.create({
        data: {
          containerBarcode: dto.containerBarcode,
          packageType,
        },
      });

      // Create container snapshot
      const snapshot =
        await tx.containerSnapshot.create({
          data: {
            id: aggregate.id,
            containerBarcode: dto.containerBarcode,
            packageType,
            currentStatus: ContainerStatus.OPEN,
            currentTerminalId: dto.terminalId,
          },
        });

      // Create immutable creation event
      const event =
        await tx.containerEvent.create({
          data: {
            containerId: snapshot.id,
            eventType:
              ContainerEventType.CONTAINER_CREATED,
            correlationId,
            metadata: {
              packageType,
              terminalId: dto.terminalId,
            },
          },
        });

      const terminalEvent = await tx.terminalEvent.create({
        data: {
          terminalId: dto.terminalId,
          eventType: TerminalEventType.CONTAINER_RECEIVED,
          correlationId,
          payload: {
            containerId: snapshot.id,
            containerBarcode: snapshot.containerBarcode,
          },
        },
      });
      await tx.terminalSnapshot.update({
        where: { terminalId: dto.terminalId },
        data: {
          containerCount: { increment: 1 },
          lastActivityAt: terminalEvent.createdAt,
        },
      });

      return {
        snapshot,
        event,
      };
    });
  }

  async closeContainer<T = undefined>(
    containerId: string,
    requestId?: string,
    transactionHook?: TransactionHook<T>,
  ) {
    const correlationId = requestId ?? randomUUID();
    return this.prisma.$transaction(async (tx) => {
      const container = await tx.containerSnapshot.findUnique({
        where: { id: containerId },
      });
      if (!container) throw new NotFoundException('Container not found');
      if (container.currentStatus !== ContainerStatus.OPEN) {
        throw new BadRequestException('Only open containers can be closed');
      }
      const event = await tx.containerEvent.create({
        data: {
          containerId,
          eventType: ContainerEventType.CONTAINER_CLOSED,
          correlationId,
          metadata: { packageCount: container.packageCount },
        },
      });
      const snapshot = await tx.containerSnapshot.update({
        where: { id: containerId },
        data: { currentStatus: ContainerStatus.CLOSED },
      });
      const hookResult = transactionHook
        ? await transactionHook(tx)
        : undefined;
      return { snapshot, event, hookResult };
    });
  }

    async loadPackage<T = undefined>(
    containerId: string,
    dto: LoadPackageDto,
    requestId?: string,
    transactionHook?: TransactionHook<T>,
    ) {
    const correlationId = requestId ?? randomUUID();
    const result = await this.prisma.$transaction(async (tx) => {

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

        if (packageSnapshot.packageType !== container.packageType) {
          throw new BadRequestException(
            `Package type ${packageSnapshot.packageType} is not accepted by this ${container.packageType} container`,
          );
        }
        if (
          container.currentTerminalId === null ||
          packageSnapshot.currentTerminalId !== container.currentTerminalId
        ) {
          throw new BadRequestException(
            'Package and container must be owned by the same terminal',
          );
        }
        if (container.currentStatus !== ContainerStatus.OPEN) {
          throw new BadRequestException('Only open containers can be loaded');
        }

        const packageEvent = await tx.packageEvent.create({
        data: {
            packageId: packageSnapshot.id,
            eventType:
            PackageEventType.PACKAGE_LOADED_TO_CONTAINER,
            terminalId: container.currentTerminalId,
            correlationId,
            metadata: { containerId, containerBarcode: container.containerBarcode },
        },
        });
        await tx.packageProjectionOutbox.create({
          data: { packageEventId: packageEvent.id },
        });
        await tx.containerEvent.create({
          data: {
            containerId,
            eventType: ContainerEventType.PACKAGE_LOADED,
            correlationId,
            metadata: {
              packageId: packageSnapshot.id,
              trackingNumber: packageSnapshot.trackingNumber,
            },
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

        const hookResult = transactionHook
          ? await transactionHook(tx, packageEvent.id)
          : undefined;
        return {
        success: true,
        packageId: packageSnapshot.id,
        containerId,
        packageEventId: packageEvent.id,
        hookResult,
        };
    });
    await this.packages.processProjection(result.packageEventId);
    return result;
    }

    async unloadPackage<T = undefined>(
  containerId: string,
  dto: LoadPackageDto,
  requestId?: string,
  transactionHook?: TransactionHook<T>,
) {
  const correlationId = requestId ?? randomUUID();
  const result = await this.prisma.$transaction(async (tx) => {

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
    
    const packageEvent = await tx.packageEvent.create({
  data: {
    packageId: packageSnapshot.id,
    eventType:
      PackageEventType.PACKAGE_UNLOADED_FROM_CONTAINER,
    terminalId: container.currentTerminalId,
    correlationId,
    metadata: { containerId, containerBarcode: container.containerBarcode },
  },
});
    await tx.packageProjectionOutbox.create({
      data: { packageEventId: packageEvent.id },
    });
    await tx.containerEvent.create({
      data: {
        containerId,
        eventType: ContainerEventType.PACKAGE_UNLOADED,
        correlationId,
        metadata: {
          packageId: packageSnapshot.id,
          trackingNumber: packageSnapshot.trackingNumber,
        },
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

    const hookResult = transactionHook
      ? await transactionHook(tx, packageEvent.id)
      : undefined;
    return {
      success: true,
      packageId: packageSnapshot.id,
      containerId,
      packageEventId: packageEvent.id,
      hookResult,
    };
  });
  await this.packages.processProjection(result.packageEventId);
  return result;
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
  const snapshot = await this.prisma.containerSnapshot.findUnique({
    where: { containerBarcode },
  });

  if (!snapshot) {
    throw new NotFoundException(
      'Container not found',
    );
  }

  return this.prisma.containerEvent.findMany({
    where: { containerId: snapshot.id },
    orderBy: { createdAt: 'asc' },
  });
}

async getContainerPackages(
  containerBarcode: string,
) {
  const container =
    await this.prisma.containerSnapshot.findUnique({
      where: {
        containerBarcode,
      },
    });

  if (!container) {
    throw new NotFoundException(
      'Container not found',
    );
  }

  const packages =
    await this.prisma.packageSnapshot.findMany({
      where: {
        currentContainerId: container.id,
      },
      orderBy: {
        trackingNumber: 'asc',
      },
    });

  return {
    containerBarcode,
    packageCount: packages.length,
    packages,
  };
}

}
