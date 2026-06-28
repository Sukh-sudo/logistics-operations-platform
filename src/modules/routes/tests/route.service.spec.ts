import { BadRequestException, ConflictException } from '@nestjs/common';
import { RouteEventType, RouteStatus } from '@prisma/client';
import { RouteService } from '../services/route.service';

describe('RouteService', () => {
  const tx = {
    terminal: { findMany: jest.fn() },
    route: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    routeStop: {
      create: jest.fn(),
      delete: jest.fn(),
      updateMany: jest.fn(),
      findMany: jest.fn(),
    },
    routeEvent: { create: jest.fn() },
    routeSnapshot: { create: jest.fn(), update: jest.fn() },
  };
  const prisma = {
    $transaction: jest.fn((callback) => callback(tx)),
    route: { findMany: jest.fn(), findUnique: jest.fn() },
  };
  let service: RouteService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new RouteService(prisma as never);
  });

  it('creates the aggregate, immutable event, and snapshot in one transaction', async () => {
    const createdAt = new Date();
    tx.terminal.findMany.mockResolvedValue([{ id: 1 }, { id: 2 }]);
    tx.route.findUnique.mockResolvedValue(null);
    tx.route.create.mockResolvedValue({
      id: 'route-1',
      routeNumber: 'AB-001',
      name: 'Calgary to Edmonton',
      originTerminalId: 1,
      destinationTerminalId: 2,
      estimatedDistance: 300,
      estimatedDuration: 180,
    });
    tx.routeEvent.create.mockResolvedValue({
      id: 'event-1',
      eventType: RouteEventType.ROUTE_CREATED,
      createdAt,
    });
    tx.routeSnapshot.create.mockResolvedValue({
      routeId: 'route-1',
      currentStatus: RouteStatus.CREATED,
    });

    const result = await service.createRoute({
      routeNumber: ' ab-001 ',
      name: 'Calgary to Edmonton',
      originTerminalId: 1,
      destinationTerminalId: 2,
      estimatedDistance: 300,
      estimatedDuration: 180,
    });

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(tx.route.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ routeNumber: 'AB-001' }),
    });
    expect(tx.routeEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        routeId: 'route-1',
        eventType: RouteEventType.ROUTE_CREATED,
      }),
    });
    expect(tx.routeSnapshot.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        routeId: 'route-1',
        currentStops: [],
        lastActivityAt: createdAt,
      }),
    });
    expect(result.snapshot.currentStatus).toBe(RouteStatus.CREATED);
  });

  it('rejects a route whose origin and destination are the same', async () => {
    await expect(
      service.createRoute({
        routeNumber: 'AB-002',
        name: 'Invalid route',
        originTerminalId: 1,
        destinationTerminalId: 1,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(tx.route.create).not.toHaveBeenCalled();
  });

  it('adds a stop, generates an event, and rebuilds the stop snapshot', async () => {
    const createdAt = new Date();
    tx.route.findUnique.mockResolvedValue({
      id: 'route-1',
      status: RouteStatus.ACTIVE,
      originTerminalId: 1,
      destinationTerminalId: 2,
      stops: [],
      snapshot: {},
    });
    tx.terminal.findMany.mockResolvedValue([{ id: 3 }]);
    tx.routeStop.create.mockResolvedValue({
      id: 'stop-1',
      routeId: 'route-1',
      terminalId: 3,
      sequence: 1,
      estimatedArrivalOffset: 90,
      estimatedDepartureOffset: 105,
    });
    tx.routeEvent.create.mockResolvedValue({
      id: 'event-1',
      eventType: RouteEventType.STOP_ADDED,
      createdAt,
    });
    tx.routeStop.findMany.mockResolvedValue([
      {
        id: 'stop-1',
        terminalId: 3,
        sequence: 1,
        estimatedArrivalOffset: 90,
        estimatedDepartureOffset: 105,
      },
    ]);
    tx.routeSnapshot.update.mockResolvedValue({
      routeId: 'route-1',
      stopCount: 1,
    });

    const result = await service.addStop('route-1', {
      terminalId: 3,
      estimatedArrivalOffset: 90,
      estimatedDepartureOffset: 105,
    });

    expect(tx.routeEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ eventType: RouteEventType.STOP_ADDED }),
    });
    expect(tx.routeSnapshot.update).toHaveBeenCalledWith({
      where: { routeId: 'route-1' },
      data: expect.objectContaining({
        stopCount: 1,
        currentStops: [expect.objectContaining({ terminalId: 3, sequence: 1 })],
      }),
    });
    expect(result.snapshot.stopCount).toBe(1);
  });

  it('rejects duplicate endpoint terminals as intermediate stops', async () => {
    tx.route.findUnique.mockResolvedValue({
      id: 'route-1',
      status: RouteStatus.CREATED,
      originTerminalId: 1,
      destinationTerminalId: 2,
      stops: [],
      snapshot: {},
    });

    await expect(
      service.addStop('route-1', {
        terminalId: 1,
        estimatedArrivalOffset: 10,
        estimatedDepartureOffset: 20,
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('retires only active routes and updates the snapshot atomically', async () => {
    const createdAt = new Date();
    tx.route.findUnique.mockResolvedValue({
      id: 'route-1',
      status: RouteStatus.ACTIVE,
      originTerminalId: 1,
      destinationTerminalId: 2,
      stops: [],
      snapshot: {},
    });
    tx.route.update.mockResolvedValue({ id: 'route-1', status: RouteStatus.RETIRED });
    tx.routeEvent.create.mockResolvedValue({
      eventType: RouteEventType.ROUTE_RETIRED,
      createdAt,
    });
    tx.routeSnapshot.update.mockResolvedValue({
      routeId: 'route-1',
      currentStatus: RouteStatus.RETIRED,
    });

    const result = await service.retireRoute('route-1');

    expect(tx.route.update).toHaveBeenCalledWith({
      where: { id: 'route-1' },
      data: { status: RouteStatus.RETIRED },
    });
    expect(tx.routeEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ eventType: RouteEventType.ROUTE_RETIRED }),
    });
    expect(result.snapshot.currentStatus).toBe(RouteStatus.RETIRED);
  });
});
