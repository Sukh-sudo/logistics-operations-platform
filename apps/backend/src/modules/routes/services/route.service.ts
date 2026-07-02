import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, RouteEventType, RouteStatus } from '@prisma/client';
import { randomUUID } from 'crypto';
import { PrismaService } from '../../../infrastructure/prisma/prisma.service';
import { AddStopDto } from '../dto/add-stop.dto';
import { CreateRouteDto } from '../dto/create-route.dto';
import { UpdateRouteDto } from '../dto/update-route.dto';

type TransactionClient = Prisma.TransactionClient;

@Injectable()
export class RouteService {
  constructor(private readonly prisma: PrismaService) {}

  async createRoute(dto: CreateRouteDto, requestId?: string) {
    const correlationId = requestId ?? randomUUID();
    const routeNumber = this.normalizeRouteNumber(dto.routeNumber);

    return this.prisma.$transaction(async (tx) => {
      this.validateDistinctTerminals(
        dto.originTerminalId,
        dto.destinationTerminalId,
      );
      await this.ensureTerminalsExist(tx, [
        dto.originTerminalId,
        dto.destinationTerminalId,
      ]);

      const existing = await tx.route.findUnique({ where: { routeNumber } });
      if (existing) {
        throw new ConflictException('Route number already exists');
      }

      const route = await tx.route.create({
        data: {
          routeNumber,
          name: dto.name.trim(),
          originTerminalId: dto.originTerminalId,
          destinationTerminalId: dto.destinationTerminalId,
          estimatedDistance: dto.estimatedDistance ?? 0,
          estimatedDuration: dto.estimatedDuration ?? 0,
        },
      });
      const event = await tx.routeEvent.create({
        data: {
          routeId: route.id,
          eventType: RouteEventType.ROUTE_CREATED,
          correlationId,
          payload: {
            routeNumber: route.routeNumber,
            name: route.name,
            originTerminalId: route.originTerminalId,
            destinationTerminalId: route.destinationTerminalId,
            estimatedDistance: route.estimatedDistance,
            estimatedDuration: route.estimatedDuration,
          },
        },
      });
      const snapshot = await tx.routeSnapshot.create({
        data: {
          routeId: route.id,
          currentStops: [],
          estimatedDistance: route.estimatedDistance,
          estimatedDuration: route.estimatedDuration,
          lastActivityAt: event.createdAt,
        },
      });

      return { route, snapshot, event };
    });
  }

  async updateRoute(routeId: string, dto: UpdateRouteDto, requestId?: string) {
    if (Object.values(dto).every((value) => value === undefined)) {
      throw new BadRequestException('At least one route field is required');
    }
    const correlationId = requestId ?? randomUUID();

    return this.prisma.$transaction(async (tx) => {
      const current = await this.getRouteForMutation(tx, routeId);
      this.ensureMutable(current.status);

      const originTerminalId = dto.originTerminalId ?? current.originTerminalId;
      const destinationTerminalId =
        dto.destinationTerminalId ?? current.destinationTerminalId;
      this.validateDistinctTerminals(originTerminalId, destinationTerminalId);
      await this.ensureTerminalsExist(tx, [originTerminalId, destinationTerminalId]);
      this.ensureStopsDoNotUseEndpoints(
        current.stops,
        originTerminalId,
        destinationTerminalId,
      );

      const route = await tx.route.update({
        where: { id: routeId },
        data: {
          routeNumber:
            dto.routeNumber === undefined
              ? undefined
              : this.normalizeRouteNumber(dto.routeNumber),
          name: dto.name?.trim(),
          originTerminalId: dto.originTerminalId,
          destinationTerminalId: dto.destinationTerminalId,
          estimatedDistance: dto.estimatedDistance,
          estimatedDuration: dto.estimatedDuration,
        },
      });
      const event = await tx.routeEvent.create({
        data: {
          routeId,
          eventType: RouteEventType.ROUTE_UPDATED,
          correlationId,
          payload: this.updatePayload(dto),
        },
      });
      const snapshot = await tx.routeSnapshot.update({
        where: { routeId },
        data: {
          estimatedDistance: route.estimatedDistance,
          estimatedDuration: route.estimatedDuration,
          lastActivityAt: event.createdAt,
        },
      });

      return { route, snapshot, event };
    });
  }

  async getRoutes() {
    return this.prisma.route.findMany({
      include: {
        originTerminal: true,
        destinationTerminal: true,
        stops: { include: { terminal: true }, orderBy: { sequence: 'asc' } },
        snapshot: true,
      },
      orderBy: { routeNumber: 'asc' },
    });
  }

  async getRoute(routeId: string) {
    const route = await this.prisma.route.findUnique({
      where: { id: routeId },
      include: {
        originTerminal: true,
        destinationTerminal: true,
        stops: { include: { terminal: true }, orderBy: { sequence: 'asc' } },
        snapshot: true,
      },
    });
    if (!route) {
      throw new NotFoundException('Route not found');
    }
    return route;
  }

  async activateRoute(routeId: string, requestId?: string) {
    return this.changeStatus(
      routeId,
      RouteStatus.CREATED,
      RouteStatus.ACTIVE,
      RouteEventType.ROUTE_ACTIVATED,
      requestId,
    );
  }

  async retireRoute(routeId: string, requestId?: string) {
    return this.changeStatus(
      routeId,
      RouteStatus.ACTIVE,
      RouteStatus.RETIRED,
      RouteEventType.ROUTE_RETIRED,
      requestId,
    );
  }

  async addStop(routeId: string, dto: AddStopDto, requestId?: string) {
    if (dto.estimatedDepartureOffset < dto.estimatedArrivalOffset) {
      throw new BadRequestException(
        'Departure offset cannot be before arrival offset',
      );
    }
    const correlationId = requestId ?? randomUUID();

    return this.prisma.$transaction(async (tx) => {
      const route = await this.getRouteForMutation(tx, routeId);
      this.ensureMutable(route.status);
      if (
        dto.terminalId === route.originTerminalId ||
        dto.terminalId === route.destinationTerminalId ||
        route.stops.some((stop) => stop.terminalId === dto.terminalId)
      ) {
        throw new ConflictException('Terminal is already part of the route');
      }
      await this.ensureTerminalsExist(tx, [dto.terminalId]);

      const sequence = dto.sequence ?? route.stops.length + 1;
      if (sequence > route.stops.length + 1) {
        throw new BadRequestException('Stop sequence must be contiguous');
      }

      if (sequence <= route.stops.length) {
        await tx.routeStop.updateMany({
          where: { routeId, sequence: { gte: sequence } },
          data: { sequence: { increment: 1000000 } },
        });
        await tx.routeStop.updateMany({
          where: { routeId, sequence: { gte: sequence + 1000000 } },
          data: { sequence: { decrement: 999999 } },
        });
      }

      const stop = await tx.routeStop.create({
        data: {
          routeId,
          terminalId: dto.terminalId,
          sequence,
          estimatedArrivalOffset: dto.estimatedArrivalOffset,
          estimatedDepartureOffset: dto.estimatedDepartureOffset,
        },
      });
      const event = await tx.routeEvent.create({
        data: {
          routeId,
          eventType: RouteEventType.STOP_ADDED,
          correlationId,
          payload: {
            stopId: stop.id,
            terminalId: stop.terminalId,
            sequence: stop.sequence,
            estimatedArrivalOffset: stop.estimatedArrivalOffset,
            estimatedDepartureOffset: stop.estimatedDepartureOffset,
          },
        },
      });
      const snapshot = await this.refreshStopSnapshot(tx, routeId, event.createdAt);

      return { stop, snapshot, event };
    });
  }

  async removeStop(routeId: string, stopId: string, requestId?: string) {
    const correlationId = requestId ?? randomUUID();

    return this.prisma.$transaction(async (tx) => {
      const route = await this.getRouteForMutation(tx, routeId);
      this.ensureMutable(route.status);
      const stop = route.stops.find((item) => item.id === stopId);
      if (!stop) {
        throw new NotFoundException('Route stop not found');
      }

      await tx.routeStop.delete({ where: { id: stopId } });
      await tx.routeStop.updateMany({
        where: { routeId, sequence: { gt: stop.sequence } },
        data: { sequence: { decrement: 1 } },
      });
      const event = await tx.routeEvent.create({
        data: {
          routeId,
          eventType: RouteEventType.STOP_REMOVED,
          correlationId,
          payload: {
            stopId: stop.id,
            terminalId: stop.terminalId,
            sequence: stop.sequence,
          },
        },
      });
      const snapshot = await this.refreshStopSnapshot(tx, routeId, event.createdAt);

      return { removedStopId: stopId, snapshot, event };
    });
  }

  private async changeStatus(
    routeId: string,
    requiredStatus: RouteStatus,
    nextStatus: RouteStatus,
    eventType: RouteEventType,
    requestId?: string,
  ) {
    const correlationId = requestId ?? randomUUID();
    return this.prisma.$transaction(async (tx) => {
      const current = await this.getRouteForMutation(tx, routeId);
      if (current.status !== requiredStatus) {
        throw new ConflictException(
          `Route must be ${requiredStatus} to become ${nextStatus}`,
        );
      }
      const route = await tx.route.update({
        where: { id: routeId },
        data: { status: nextStatus },
      });
      const event = await tx.routeEvent.create({
        data: {
          routeId,
          eventType,
          correlationId,
          payload: { previousStatus: requiredStatus, status: nextStatus },
        },
      });
      const snapshot = await tx.routeSnapshot.update({
        where: { routeId },
        data: { currentStatus: nextStatus, lastActivityAt: event.createdAt },
      });
      return { route, snapshot, event };
    });
  }

  private async getRouteForMutation(tx: TransactionClient, routeId: string) {
    const route = await tx.route.findUnique({
      where: { id: routeId },
      include: { stops: { orderBy: { sequence: 'asc' } }, snapshot: true },
    });
    if (!route) {
      throw new NotFoundException('Route not found');
    }
    return route;
  }

  private async ensureTerminalsExist(tx: TransactionClient, terminalIds: number[]) {
    const uniqueIds = [...new Set(terminalIds)];
    const terminals = await tx.terminal.findMany({
      where: { id: { in: uniqueIds } },
      select: { id: true },
    });
    if (terminals.length !== uniqueIds.length) {
      throw new NotFoundException('One or more terminals were not found');
    }
  }

  private async refreshStopSnapshot(
    tx: TransactionClient,
    routeId: string,
    lastActivityAt: Date,
  ) {
    const stops = await tx.routeStop.findMany({
      where: { routeId },
      orderBy: { sequence: 'asc' },
    });
    return tx.routeSnapshot.update({
      where: { routeId },
      data: {
        stopCount: stops.length,
        currentStops: stops.map((stop) => ({
          id: stop.id,
          terminalId: stop.terminalId,
          sequence: stop.sequence,
          estimatedArrivalOffset: stop.estimatedArrivalOffset,
          estimatedDepartureOffset: stop.estimatedDepartureOffset,
        })),
        lastActivityAt,
      },
    });
  }

  private validateDistinctTerminals(originId: number, destinationId: number) {
    if (originId === destinationId) {
      throw new BadRequestException(
        'Origin and destination terminals must be different',
      );
    }
  }

  private ensureStopsDoNotUseEndpoints(
    stops: Array<{ terminalId: number }>,
    originId: number,
    destinationId: number,
  ) {
    if (
      stops.some(
        (stop) =>
          stop.terminalId === originId || stop.terminalId === destinationId,
      )
    ) {
      throw new ConflictException(
        'Origin or destination cannot duplicate an intermediate stop',
      );
    }
  }

  private ensureMutable(status: RouteStatus) {
    if (status === RouteStatus.RETIRED) {
      throw new ConflictException('Retired routes cannot be modified');
    }
  }

  private normalizeRouteNumber(routeNumber: string) {
    return routeNumber.trim().toUpperCase();
  }

  private updatePayload(dto: UpdateRouteDto): Prisma.InputJsonObject {
    const payload: Record<string, string | number> = {};
    if (dto.routeNumber !== undefined) {
      payload.routeNumber = this.normalizeRouteNumber(dto.routeNumber);
    }
    if (dto.name !== undefined) payload.name = dto.name.trim();
    if (dto.originTerminalId !== undefined) {
      payload.originTerminalId = dto.originTerminalId;
    }
    if (dto.destinationTerminalId !== undefined) {
      payload.destinationTerminalId = dto.destinationTerminalId;
    }
    if (dto.estimatedDistance !== undefined) {
      payload.estimatedDistance = dto.estimatedDistance;
    }
    if (dto.estimatedDuration !== undefined) {
      payload.estimatedDuration = dto.estimatedDuration;
    }
    return payload;
  }
}
