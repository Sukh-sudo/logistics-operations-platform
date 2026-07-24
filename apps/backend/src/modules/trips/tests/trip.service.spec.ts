import { ConflictException } from '@nestjs/common';
import { DriverStatus, FleetEventType, RouteStatus, TrailerStatus, TripEventType, TripStatus, TruckStatus } from '@prisma/client';
import { TripService } from '../services/trip.service';

describe('TripService', () => {
  const tx = {
    route: { findUnique: jest.fn() }, trip: { findUnique: jest.fn(), create: jest.fn(), update: jest.fn() },
    tripStop: { createMany: jest.fn(), findMany: jest.fn(), update: jest.fn() },
    tripEvent: { create: jest.fn() }, tripSnapshot: { create: jest.fn(), update: jest.fn() },
    equipmentAssignment: { findUnique: jest.fn(), update: jest.fn() },
    truck: { update: jest.fn() }, driver: { update: jest.fn() },
    fleetEvent: { create: jest.fn() },
    truckSnapshot: { findUnique: jest.fn(), update: jest.fn() },
    driverSnapshot: { findUnique: jest.fn(), update: jest.fn() },
    trailerSnapshot: { findUnique: jest.fn(), update: jest.fn() },
    trailerEvent: { create: jest.fn() },
    terminalEvent: { create: jest.fn() }, terminalSnapshot: { update: jest.fn() },
    containerSnapshot: { findMany: jest.fn(), updateMany: jest.fn() },
    containerEvent: { create: jest.fn() },
    packageSnapshot: { findMany: jest.fn(), updateMany: jest.fn() },
    packageEvent: { create: jest.fn() },
    packageProjectionOutbox: { create: jest.fn() },
  };
  const prisma = { $transaction: jest.fn((callback) => callback(tx)), trip: { findMany: jest.fn(), findUnique: jest.fn() } };
  const packages = { processProjection: jest.fn() };
  let service: TripService;

  beforeEach(() => {
    jest.clearAllMocks();
    tx.containerSnapshot.findMany.mockResolvedValue([]);
    tx.packageSnapshot.findMany.mockResolvedValue([]);
    service = new TripService(prisma as never, packages as never);
  });

  it('creates route-derived stops, an event, and a snapshot atomically', async () => {
    const createdAt = new Date();
    tx.route.findUnique.mockResolvedValue({ id: 'route-1', status: RouteStatus.ACTIVE, originTerminalId: 1, destinationTerminalId: 3, estimatedDuration: 120, stops: [{ terminalId: 2, sequence: 1, estimatedArrivalOffset: 50, estimatedDepartureOffset: 60 }] });
    tx.trip.findUnique.mockResolvedValue(null);
    tx.trip.create.mockResolvedValue({ id: 'trip-1', tripNumber: 'T-001', status: TripStatus.CREATED });
    tx.tripStop.findMany.mockResolvedValue([{ id: 's1' }, { id: 's2' }, { id: 's3' }]);
    tx.tripEvent.create.mockResolvedValue({ eventType: TripEventType.TRIP_CREATED, createdAt });
    tx.tripSnapshot.create.mockResolvedValue({ tripId: 'trip-1', totalStops: 3 });

    const result = await service.createTrip({ tripNumber: ' t-001 ', routeId: 'route-1', plannedDeparture: '2026-07-02T12:00:00Z' });
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(tx.tripStop.createMany).toHaveBeenCalledWith({ data: expect.arrayContaining([expect.objectContaining({ terminalId: 1, sequence: 1 }), expect.objectContaining({ terminalId: 3, sequence: 3 })]) });
    expect(tx.tripEvent.create).toHaveBeenCalledWith({ data: expect.objectContaining({ eventType: TripEventType.TRIP_CREATED }) });
    expect(result.snapshot.totalStops).toBe(3);
  });

  it('rejects trips for inactive routes', async () => {
    tx.route.findUnique.mockResolvedValue({ id: 'route-1', status: RouteStatus.RETIRED, stops: [] });
    await expect(service.createTrip({ tripNumber: 'T-2', routeId: 'route-1', plannedDeparture: '2026-07-02T12:00:00Z' })).rejects.toBeInstanceOf(ConflictException);
  });

  it('requires equipment and starts all assigned resources atomically', async () => {
    const createdAt = new Date();
    tx.trip.findUnique.mockResolvedValue({
      id: 'trip-1',
      status: TripStatus.CREATED,
      equipmentAssignmentId: 'assignment-1',
      route: { originTerminalId: 1 },
      stops: [],
      snapshot: {},
    });
    tx.equipmentAssignment.findUnique.mockResolvedValue({ id: 'assignment-1', tripId: 'trip-1', truckId: 'truck-1', driverId: 'driver-1', trailerId: 'trailer-1', status: 'ACTIVE' });
    tx.trip.update.mockResolvedValue({ id: 'trip-1', status: TripStatus.IN_PROGRESS });
    tx.tripEvent.create.mockResolvedValue({ eventType: TripEventType.TRIP_STARTED, createdAt });
    tx.tripSnapshot.update.mockResolvedValue({ currentStatus: TripStatus.IN_PROGRESS });
    tx.fleetEvent.create.mockResolvedValueOnce({ eventType: FleetEventType.TRUCK_IN_SERVICE, createdAt }).mockResolvedValueOnce({ eventType: FleetEventType.DRIVER_ON_TRIP, createdAt });
    tx.trailerEvent.create.mockResolvedValue({ eventType: 'TRAILER_DEPARTED' });
    tx.truckSnapshot.update
      .mockResolvedValueOnce({ currentTerminalId: 1 })
      .mockResolvedValueOnce({ currentStatus: TruckStatus.IN_SERVICE });
    tx.driverSnapshot.update
      .mockResolvedValueOnce({ currentTerminalId: 1 })
      .mockResolvedValueOnce({ currentStatus: DriverStatus.ON_TRIP });
    tx.trailerSnapshot.update
      .mockResolvedValueOnce({ currentTerminalId: 1 })
      .mockResolvedValueOnce({ currentStatus: TrailerStatus.IN_TRANSIT });
    tx.truckSnapshot.findUnique.mockResolvedValue({ currentTerminalId: 1 });
    tx.driverSnapshot.findUnique.mockResolvedValue({ currentTerminalId: 1 });
    tx.trailerSnapshot.findUnique.mockResolvedValue({ currentTerminalId: 1 });
    tx.terminalEvent.create.mockResolvedValue({ createdAt });
    tx.terminalSnapshot.update.mockResolvedValue({});

    const result = await service.startTrip('trip-1');

    expect(tx.truck.update).toHaveBeenCalledWith({
      where: { id: 'truck-1' },
      data: { status: TruckStatus.IN_SERVICE, terminalId: null },
    });
    expect(tx.driver.update).toHaveBeenCalledWith({
      where: { id: 'driver-1' },
      data: { status: DriverStatus.ON_TRIP, terminalId: null },
    });
    expect(tx.trailerSnapshot.update).toHaveBeenCalledWith({
      where: { id: 'trailer-1' },
      data: { currentStatus: TrailerStatus.IN_TRANSIT, currentTerminalId: null },
    });
    expect(result.fleet.events.map((event) => event.eventType)).toEqual([FleetEventType.TRUCK_IN_SERVICE, FleetEventType.DRIVER_ON_TRIP]);
  });

  it('rejects starting a trip without an active equipment assignment', async () => {
    tx.trip.findUnique.mockResolvedValue({ id: 'trip-1', status: TripStatus.CREATED, equipmentAssignmentId: null, stops: [], snapshot: {} });
    await expect(service.startTrip('trip-1')).rejects.toBeInstanceOf(ConflictException);
    expect(tx.trip.update).not.toHaveBeenCalled();
  });

  it('emits STOP_DELAYED and updates the delay snapshot for a late stop', async () => {
    const createdAt = new Date();
    const plannedArrival = new Date(Date.now() - 10 * 60 * 1000);
    tx.trip.findUnique.mockResolvedValue({
      id: 'trip-1',
      status: TripStatus.IN_PROGRESS,
      equipmentAssignmentId: 'assignment-1',
      route: { originTerminalId: 1 },
      stops: [{
        id: 'stop-1',
        terminalId: 2,
        sequence: 1,
        plannedArrival,
        plannedDeparture: plannedArrival,
        status: 'PENDING',
        delayMinutes: 0,
      }],
      snapshot: {},
    });
    tx.tripStop.update.mockResolvedValue({
      id: 'stop-1',
      status: 'ARRIVED',
      delayMinutes: 10,
    });
    tx.tripEvent.create
      .mockResolvedValueOnce({ eventType: TripEventType.STOP_ARRIVED, createdAt })
      .mockResolvedValueOnce({ eventType: TripEventType.STOP_DELAYED, createdAt });
    tx.tripSnapshot.update.mockResolvedValue({ delayMinutes: 10 });

    const result = await service.arriveStop('trip-1', 'stop-1', {});

    expect(tx.tripEvent.create).toHaveBeenNthCalledWith(2, {
      data: expect.objectContaining({
        eventType: TripEventType.STOP_DELAYED,
        payload: expect.objectContaining({ stopId: 'stop-1' }),
      }),
    });
    expect(result.delayEvent?.eventType).toBe(TripEventType.STOP_DELAYED);
  });

  it('releases fleet resources when an in-progress trip is cancelled', async () => {
    const createdAt = new Date();
    tx.trip.findUnique.mockResolvedValue({
      id: 'trip-1',
      status: TripStatus.IN_PROGRESS,
      equipmentAssignmentId: 'assignment-1',
      route: { originTerminalId: 1 },
      stops: [],
      snapshot: {},
    });
    tx.equipmentAssignment.findUnique.mockResolvedValue({ id: 'assignment-1', tripId: 'trip-1', truckId: 'truck-1', driverId: 'driver-1', trailerId: 'trailer-1', status: 'ACTIVE' });
    tx.trip.update.mockResolvedValue({ id: 'trip-1', status: TripStatus.CANCELLED });
    tx.tripEvent.create.mockResolvedValue({ eventType: TripEventType.TRIP_CANCELLED, createdAt });
    tx.tripSnapshot.update.mockResolvedValue({ currentStatus: TripStatus.CANCELLED });
    tx.fleetEvent.create.mockResolvedValueOnce({ eventType: FleetEventType.EQUIPMENT_RELEASED, createdAt }).mockResolvedValueOnce({ eventType: FleetEventType.EQUIPMENT_RELEASED, createdAt });

    await service.cancelTrip('trip-1');

    expect(tx.equipmentAssignment.update).toHaveBeenCalledWith({ where: { id: 'assignment-1' }, data: expect.objectContaining({ status: 'RELEASED' }) });
    expect(tx.truckSnapshot.update).toHaveBeenCalledWith({ where: { truckId: 'truck-1' }, data: expect.objectContaining({ currentStatus: TruckStatus.AVAILABLE, assignedTripId: null }) });
    expect(tx.driverSnapshot.update).toHaveBeenCalledWith({ where: { driverId: 'driver-1' }, data: expect.objectContaining({ currentStatus: DriverStatus.AVAILABLE, assignedTripId: null }) });
    expect(tx.trailerSnapshot.update).toHaveBeenCalledWith({ where: { id: 'trailer-1' }, data: { currentStatus: TrailerStatus.ARRIVED } });
  });
});
