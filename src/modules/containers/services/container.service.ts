import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/prisma/prisma.service';
import { ContainerStatus } from '@prisma/client';
import { CreateContainerDto } from '../dto/create-container.dto';

@Injectable()
export class ContainerService {
  constructor(
    private readonly prisma: PrismaService,
  ) {}

  async createContainer(dto: CreateContainerDto) {
    return this.prisma.$transaction(async (tx) => {

      // Create container snapshot
      const snapshot =
        await tx.containerSnapshot.create({
          data: {
            containerBarcode: dto.containerBarcode,
            currentStatus: ContainerStatus.OPEN,
          },
        });

      // Create first event
      const event =
        await tx.containerEvent.create({
          data: {
            containerId: snapshot.id,
            eventType: 'CONTAINER_CREATED',
          },
        });

      return {
        snapshot,
        event,
      };
    });
  }
}