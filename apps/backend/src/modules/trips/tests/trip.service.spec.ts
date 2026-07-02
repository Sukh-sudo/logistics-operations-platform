import { ConflictException } from '@nestjs/common';
import { RouteStatus, TripEventType, TripStatus } from '@prisma/client';
import { TripService } from '../services/trip.service';

describe('TripService', () => {
  const tx = {
    route: { findUnique: jest.fn() }, trip: { findUnique: jest.fn(), create: jest.fn(), update: jest.fn() },
    tripStop: { createMany: jest.fn(), findMany: jest.fn(), update: jest.fn() },
    tripEvent: { create: jest.fn() }, tripSnapshot: { create: jest.fn(), update: jest.fn() },
  };
  const prisma = { $transaction: jest.fn((callback) => callback(tx)), trip: { findMany: jest.fn(), findUnique: jest.fn() } };
  let service: TripService;

  beforeEach(() => { jest.clearAllMocks(); service = new TripService(prisma as never); });

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
});
