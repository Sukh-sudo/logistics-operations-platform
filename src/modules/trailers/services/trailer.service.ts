import { Injectable, NotFoundException, BadRequestException, } from '@nestjs/common';

import {TrailerEventType, TrailerStatus,} from '@prisma/client';

import { PrismaService } from '../../../infrastructure/prisma/prisma.service';

import { CreateTrailerDto } from '../dto/create-trailer.dto';

import { LoadContainerDto } from '../dto/load-container.dto';

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
}