import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, RouteStatus, TripEventType, TripStatus, TripStopStatus } from '@prisma/client';
import { randomUUID } from 'crypto';
import { PrismaService } from '../../../infrastructure/prisma/prisma.service';
import { CreateTripDto } from '../dto/create-trip.dto';
import { TripStopActionDto } from '../dto/trip-stop-action.dto';
import { UpdateTripDto } from '../dto/update-trip.dto';

type Tx = Prisma.TransactionClient;

@Injectable()
export class TripService {
  constructor(private readonly prisma: PrismaService) {}

  async createTrip(dto: CreateTripDto, requestId?: string) {
    const correlationId = requestId ?? randomUUID();
    const tripNumber = dto.tripNumber.trim().toUpperCase();
    const plannedDeparture = new Date(dto.plannedDeparture);
    return this.prisma.$transaction(async (tx) => {
      const route = await tx.route.findUnique({
        where: { id: dto.routeId },
        include: { stops: { orderBy: { sequence: 'asc' } } },
      });
      if (!route) throw new NotFoundException('Route not found');
      if (route.status !== RouteStatus.ACTIVE) {
        throw new ConflictException('Trip requires an active route');
      }
      if (await tx.trip.findUnique({ where: { tripNumber } })) {
        throw new ConflictException('Trip number already exists');
      }
      const plannedArrival = this.addMinutes(plannedDeparture, route.estimatedDuration);
      const trip = await tx.trip.create({
        data: {
          tripNumber,
          routeId: route.id,
          equipmentAssignmentId: dto.equipmentAssignmentId,
          plannedDeparture,
          plannedArrival,
        },
      });
      const stopInputs = [
        { terminalId: route.originTerminalId, arrival: 0, departure: 0 },
        ...route.stops.map((stop) => ({
          terminalId: stop.terminalId,
          arrival: stop.estimatedArrivalOffset,
          departure: stop.estimatedDepartureOffset,
        })),
        {
          terminalId: route.destinationTerminalId,
          arrival: route.estimatedDuration,
          departure: route.estimatedDuration,
        },
      ];
      await tx.tripStop.createMany({
        data: stopInputs.map((stop, index) => ({
          tripId: trip.id,
          terminalId: stop.terminalId,
          sequence: index + 1,
          plannedArrival: this.addMinutes(plannedDeparture, stop.arrival),
          plannedDeparture: this.addMinutes(plannedDeparture, stop.departure),
        })),
      });
      const stops = await tx.tripStop.findMany({ where: { tripId: trip.id }, orderBy: { sequence: 'asc' } });
      const event = await tx.tripEvent.create({
        data: { tripId: trip.id, eventType: TripEventType.TRIP_CREATED, correlationId, payload: { tripNumber, routeId: route.id } },
      });
      const snapshot = await tx.tripSnapshot.create({
        data: { tripId: trip.id, nextStopId: stops[0]?.id, totalStops: stops.length, lastActivityAt: event.createdAt },
      });
      return { trip, stops, event, snapshot };
    });
  }

  getTrips() {
    return this.prisma.trip.findMany({ include: { route: true, stops: { orderBy: { sequence: 'asc' } }, snapshot: true }, orderBy: { tripNumber: 'asc' } });
  }

  async getTrip(id: string) {
    const trip = await this.prisma.trip.findUnique({ where: { id }, include: { route: true, stops: { include: { terminal: true }, orderBy: { sequence: 'asc' } }, snapshot: true } });
    if (!trip) throw new NotFoundException('Trip not found');
    return trip;
  }

  async updateTrip(id: string, dto: UpdateTripDto, requestId?: string) {
    if (!dto.equipmentAssignmentId && !dto.plannedDeparture) throw new BadRequestException('At least one trip field is required');
    const correlationId = requestId ?? randomUUID();
    return this.prisma.$transaction(async (tx) => {
      const current = await this.tripForMutation(tx, id);
      this.requireStatus(current.status, TripStatus.CREATED, 'Only created trips can be updated');
      const departure = dto.plannedDeparture ? new Date(dto.plannedDeparture) : current.plannedDeparture;
      const duration = Math.round((current.plannedArrival.getTime() - current.plannedDeparture.getTime()) / 60000);
      const trip = await tx.trip.update({ where: { id }, data: { equipmentAssignmentId: dto.equipmentAssignmentId, plannedDeparture: departure, plannedArrival: this.addMinutes(departure, duration) } });
      if (dto.plannedDeparture) {
        for (const stop of current.stops) {
          const arrivalOffset = Math.round((stop.plannedArrival.getTime() - current.plannedDeparture.getTime()) / 60000);
          const departureOffset = Math.round((stop.plannedDeparture.getTime() - current.plannedDeparture.getTime()) / 60000);
          await tx.tripStop.update({ where: { id: stop.id }, data: { plannedArrival: this.addMinutes(departure, arrivalOffset), plannedDeparture: this.addMinutes(departure, departureOffset) } });
        }
      }
      const event = await tx.tripEvent.create({ data: { tripId: id, eventType: TripEventType.TRIP_UPDATED, correlationId, payload: dto as Prisma.InputJsonObject } });
      const snapshot = await tx.tripSnapshot.update({ where: { tripId: id }, data: { lastActivityAt: event.createdAt } });
      return { trip, event, snapshot };
    });
  }

  startTrip(id: string, requestId?: string) {
    return this.prisma.$transaction(async (tx) => {
      const current = await this.tripForMutation(tx, id);
      this.requireStatus(current.status, TripStatus.CREATED, 'Trip cannot be started');
      const now = new Date();
      const trip = await tx.trip.update({ where: { id }, data: { status: TripStatus.IN_PROGRESS, actualDeparture: now } });
      const event = await tx.tripEvent.create({ data: { tripId: id, eventType: TripEventType.TRIP_STARTED, correlationId: requestId ?? randomUUID() } });
      const snapshot = await tx.tripSnapshot.update({ where: { tripId: id }, data: { currentStatus: TripStatus.IN_PROGRESS, lastActivityAt: event.createdAt } });
      return { trip, event, snapshot };
    });
  }

  arriveStop(id: string, stopId: string, dto: TripStopActionDto, requestId?: string) {
    return this.stopAction(id, stopId, dto, true, requestId);
  }

  departStop(id: string, stopId: string, dto: TripStopActionDto, requestId?: string) {
    return this.stopAction(id, stopId, dto, false, requestId);
  }

  async completeTrip(id: string, requestId?: string) {
    return this.prisma.$transaction(async (tx) => {
      const current = await this.tripForMutation(tx, id);
      this.requireStatus(current.status, TripStatus.IN_PROGRESS, 'Trip is not in progress');
      if (current.stops.some((stop) => stop.status !== TripStopStatus.DEPARTED)) {
        throw new ConflictException('All stops must be completed first');
      }
      const trip = await tx.trip.update({ where: { id }, data: { status: TripStatus.COMPLETED, actualArrival: new Date() } });
      const event = await tx.tripEvent.create({ data: { tripId: id, eventType: TripEventType.TRIP_COMPLETED, correlationId: requestId ?? randomUUID() } });
      const snapshot = await tx.tripSnapshot.update({ where: { tripId: id }, data: { currentStatus: TripStatus.COMPLETED, currentStopId: null, nextStopId: null, progressPercent: 100, lastActivityAt: event.createdAt } });
      return { trip, event, snapshot };
    });
  }

  async cancelTrip(id: string, requestId?: string) {
    return this.prisma.$transaction(async (tx) => {
      const current = await this.tripForMutation(tx, id);
      if (current.status === TripStatus.COMPLETED || current.status === TripStatus.CANCELLED) throw new ConflictException('Trip cannot be cancelled');
      const trip = await tx.trip.update({ where: { id }, data: { status: TripStatus.CANCELLED } });
      const event = await tx.tripEvent.create({ data: { tripId: id, eventType: TripEventType.TRIP_CANCELLED, correlationId: requestId ?? randomUUID() } });
      const snapshot = await tx.tripSnapshot.update({ where: { tripId: id }, data: { currentStatus: TripStatus.CANCELLED, lastActivityAt: event.createdAt } });
      return { trip, event, snapshot };
    });
  }

  private async stopAction(id: string, stopId: string, dto: TripStopActionDto, arriving: boolean, requestId?: string) {
    return this.prisma.$transaction(async (tx) => {
      const trip = await this.tripForMutation(tx, id);
      this.requireStatus(trip.status, TripStatus.IN_PROGRESS, 'Trip is not in progress');
      const stop = trip.stops.find((item) => item.id === stopId);
      if (!stop) throw new NotFoundException('Trip stop not found');
      const expected = trip.stops.find((item) => item.status !== TripStopStatus.DEPARTED);
      if (expected?.id !== stopId) throw new ConflictException('Stops must be completed in sequence');
      if (arriving && stop.status !== TripStopStatus.PENDING) throw new ConflictException('Stop cannot be arrived');
      if (!arriving && stop.status !== TripStopStatus.ARRIVED) throw new ConflictException('Stop must be arrived before departure');
      const now = new Date();
      const delayMinutes = Math.max(0, Math.round((now.getTime() - (arriving ? stop.plannedArrival : stop.plannedDeparture).getTime()) / 60000));
      const updated = await tx.tripStop.update({ where: { id: stopId }, data: arriving ? { status: TripStopStatus.ARRIVED, actualArrival: now, delayMinutes, notes: dto.notes } : { status: TripStopStatus.DEPARTED, actualDeparture: now, delayMinutes, notes: dto.notes } });
      const event = await tx.tripEvent.create({ data: { tripId: id, eventType: arriving ? TripEventType.STOP_ARRIVED : TripEventType.STOP_DEPARTED, correlationId: requestId ?? randomUUID(), payload: { stopId, terminalId: stop.terminalId, sequence: stop.sequence, delayMinutes } } });
      const stops = trip.stops.map((item) => item.id === stopId ? updated : item);
      const completed = stops.filter((item) => item.status === TripStopStatus.DEPARTED).length;
      const next = stops.find((item) => item.status !== TripStopStatus.DEPARTED);
      const snapshot = await tx.tripSnapshot.update({ where: { tripId: id }, data: { currentStopId: arriving ? stopId : null, nextStopId: arriving ? stopId : next?.id ?? null, currentTerminalId: arriving ? stop.terminalId : null, completedStops: completed, progressPercent: Math.floor(completed * 100 / stops.length), delayMinutes: Math.max(...stops.map((item) => item.delayMinutes)), lastActivityAt: event.createdAt } });
      return { stop: updated, event, snapshot };
    });
  }

  private async tripForMutation(tx: Tx, id: string) {
    const trip = await tx.trip.findUnique({ where: { id }, include: { stops: { orderBy: { sequence: 'asc' } }, snapshot: true } });
    if (!trip) throw new NotFoundException('Trip not found');
    return trip;
  }

  private requireStatus(actual: TripStatus, expected: TripStatus, message: string) {
    if (actual !== expected) throw new ConflictException(message);
  }

  private addMinutes(date: Date, minutes: number) { return new Date(date.getTime() + minutes * 60000); }
}
