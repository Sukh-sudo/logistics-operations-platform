import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { DriverStatus, FleetEventType, TruckPurpose, TruckStatus } from '@prisma/client';
import { FleetService } from '../services/fleet.service';

describe('FleetService', () => {
  const tx = {
    terminal: { findUnique: jest.fn() },
    truck: { create: jest.fn(), findFirst: jest.fn(), findUnique: jest.fn(), update: jest.fn() },
    driver: { create: jest.fn(), findFirst: jest.fn(), findUnique: jest.fn(), update: jest.fn() },
    trip: { findUnique: jest.fn(), update: jest.fn() },
    equipmentAssignment: { create: jest.fn(), findFirst: jest.fn(), findUnique: jest.fn(), update: jest.fn() },
    fleetEvent: { create: jest.fn() },
    truckSnapshot: { create: jest.fn(), update: jest.fn() },
    driverSnapshot: { create: jest.fn(), update: jest.fn() },
    trailerSnapshot: { findUnique: jest.fn() },
    fleetUnitSequence: { upsert: jest.fn() },
  };
  const prisma = {
    $transaction: jest.fn((callback) => callback(tx)),
    truck: { findMany: jest.fn(), findUnique: jest.fn() },
    driver: { findMany: jest.fn(), findUnique: jest.fn() },
    equipmentAssignment: { findMany: jest.fn() },
    truckSnapshot: { findMany: jest.fn() },
    driverSnapshot: { findMany: jest.fn() },
    trailerSnapshot: { findMany: jest.fn() },
  };
  let service: FleetService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new FleetService(prisma as never);
  });

  it('assigns available equipment and updates both snapshots atomically', async () => {
    const createdAt = new Date();
    tx.trip.findUnique.mockResolvedValue({ id: 'trip-1', status: 'CREATED', equipmentAssignmentId: null });
    tx.truck.findUnique.mockResolvedValue({ id: 'truck-1', status: TruckStatus.AVAILABLE, snapshot: { assignedTripId: null } });
    tx.driver.findUnique.mockResolvedValue({ id: 'driver-1', status: DriverStatus.AVAILABLE, snapshot: { assignedTripId: null } });
    tx.trailerSnapshot.findUnique.mockResolvedValue({ id: 'trailer-1', currentStatus: 'OPEN' });
    tx.equipmentAssignment.findFirst.mockResolvedValue(null);
    tx.equipmentAssignment.create.mockResolvedValue({ id: 'assignment-1', tripId: 'trip-1', truckId: 'truck-1', driverId: 'driver-1', trailerId: 'trailer-1', status: 'ACTIVE' });
    tx.fleetEvent.create.mockResolvedValueOnce({ eventType: FleetEventType.TRUCK_ASSIGNED, createdAt }).mockResolvedValueOnce({ eventType: FleetEventType.DRIVER_ASSIGNED, createdAt });
    tx.truckSnapshot.update.mockResolvedValue({ assignedTripId: 'trip-1' });
    tx.driverSnapshot.update.mockResolvedValue({ assignedTripId: 'trip-1' });

    const result = await service.assignEquipment({ tripId: 'trip-1', truckId: 'truck-1', driverId: 'driver-1', trailerId: 'trailer-1' });

    expect(tx.equipmentAssignment.create).toHaveBeenCalled();
    expect(tx.trip.update).toHaveBeenCalledWith({ where: { id: 'trip-1' }, data: { equipmentAssignmentId: 'assignment-1' } });
    expect(result.events.map((event) => event.eventType)).toEqual([FleetEventType.TRUCK_ASSIGNED, FleetEventType.DRIVER_ASSIGNED]);
  });

  it('rejects assignment when a truck is unavailable', async () => {
    tx.trip.findUnique.mockResolvedValue({ id: 'trip-1', status: 'CREATED', equipmentAssignmentId: null });
    tx.truck.findUnique.mockResolvedValue({ id: 'truck-1', status: TruckStatus.MAINTENANCE, snapshot: { assignedTripId: null } });
    tx.driver.findUnique.mockResolvedValue({ id: 'driver-1', status: DriverStatus.AVAILABLE, snapshot: { assignedTripId: null } });
    tx.trailerSnapshot.findUnique.mockResolvedValue({ id: 'trailer-1', currentStatus: 'OPEN' });
    tx.equipmentAssignment.findFirst.mockResolvedValue(null);
    await expect(service.assignEquipment({ tripId: 'trip-1', truckId: 'truck-1', driverId: 'driver-1', trailerId: 'trailer-1' })).rejects.toBeInstanceOf(ConflictException);
    expect(tx.equipmentAssignment.create).not.toHaveBeenCalled();
  });

  it('prevents manual equipment release while a trip is in progress', async () => {
    tx.equipmentAssignment.findUnique.mockResolvedValue({ id: 'assignment-1', status: 'ACTIVE', trip: { status: 'IN_PROGRESS' } });

    await expect(service.releaseEquipment('assignment-1')).rejects.toBeInstanceOf(ConflictException);

    expect(tx.equipmentAssignment.update).not.toHaveBeenCalled();
  });

  it('creates a truck, fleet event, and truck snapshot in one transaction', async () => {
    const createdAt = new Date();
    tx.terminal.findUnique.mockResolvedValue({ id: 1, terminalCode: 'cal' });
    tx.fleetUnitSequence.upsert.mockResolvedValue({ lastNumber: 1 });
    tx.truck.findFirst.mockResolvedValue(null);
    tx.truck.create.mockResolvedValue({
      id: 'truck-1',
      unitNumber: 'LMCAL00001',
      purpose: TruckPurpose.LAST_MILE,
      licensePlate: 'ABC-123',
      status: TruckStatus.AVAILABLE,
      terminalId: 1,
    });
    tx.fleetEvent.create.mockResolvedValue({
      id: 'event-1',
      eventType: FleetEventType.TRUCK_CREATED,
      createdAt,
    });
    tx.truckSnapshot.create.mockResolvedValue({
      truckId: 'truck-1',
      currentStatus: TruckStatus.AVAILABLE,
      currentTerminalId: 1,
    });

    const result = await service.createTruck({
      purpose: TruckPurpose.LAST_MILE,
      licensePlate: ' abc-123 ',
      terminalId: 1,
      year: 2024,
      make: 'Freightliner',
      model: 'Cascadia',
    });

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(tx.truck.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        unitNumber: 'LMCAL00001',
        purpose: TruckPurpose.LAST_MILE,
        licensePlate: 'ABC-123',
        status: TruckStatus.AVAILABLE,
      }),
    });
    expect(tx.fleetEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        truckId: 'truck-1',
        eventType: FleetEventType.TRUCK_CREATED,
        payload: expect.objectContaining({
          unitNumber: 'LMCAL00001',
          purpose: TruckPurpose.LAST_MILE,
          terminalCode: 'CAL',
        }),
      }),
    });
    expect(tx.truckSnapshot.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        truckId: 'truck-1',
        currentStatus: TruckStatus.AVAILABLE,
        currentTerminalId: 1,
        lastActivityAt: createdAt,
      }),
    });
    expect(result.snapshot.currentStatus).toBe(TruckStatus.AVAILABLE);
  });

  it('creates a driver, fleet event, and driver snapshot in one transaction', async () => {
    const createdAt = new Date();
    tx.terminal.findUnique.mockResolvedValue({ id: 2 });
    tx.driver.findFirst.mockResolvedValue(null);
    tx.driver.create.mockResolvedValue({
      id: 'driver-1',
      employeeId: 'EMP-100',
      licenseNumber: 'DL-100',
      licenseClass: 'Class 1',
      status: DriverStatus.AVAILABLE,
      terminalId: 2,
    });
    tx.fleetEvent.create.mockResolvedValue({
      id: 'event-1',
      eventType: FleetEventType.DRIVER_CREATED,
      createdAt,
    });
    tx.driverSnapshot.create.mockResolvedValue({
      driverId: 'driver-1',
      currentStatus: DriverStatus.AVAILABLE,
      currentTerminalId: 2,
    });

    const result = await service.createDriver({
      employeeId: ' emp-100 ',
      licenseNumber: ' dl-100 ',
      licenseClass: 'Class 1',
      terminalId: 2,
    });

    expect(tx.driver.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        employeeId: 'EMP-100',
        licenseNumber: 'DL-100',
        status: DriverStatus.AVAILABLE,
      }),
    });
    expect(tx.fleetEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        driverId: 'driver-1',
        eventType: FleetEventType.DRIVER_CREATED,
      }),
    });
    expect(result.snapshot.currentStatus).toBe(DriverStatus.AVAILABLE);
  });

  it('rejects a duplicate license plate before creating records', async () => {
    tx.terminal.findUnique.mockResolvedValue({ id: 1, terminalCode: 'CAL' });
    tx.fleetUnitSequence.upsert.mockResolvedValue({ lastNumber: 2 });
    tx.truck.findFirst.mockResolvedValue({
      id: 'truck-1',
      unitNumber: 'LMCAL00001',
      licensePlate: 'ABC-123',
    });

    await expect(
      service.createTruck({
        purpose: TruckPurpose.LAST_MILE,
        licensePlate: 'ABC-123',
        terminalId: 1,
      }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(tx.truck.create).not.toHaveBeenCalled();
  });

  it('rejects a terminal code that cannot form the three-letter unit segment', async () => {
    tx.terminal.findUnique.mockResolvedValue({ id: 1, terminalCode: 'YYC-NORTH' });

    await expect(
      service.createTruck({
        purpose: TruckPurpose.MIDDLE_MILE,
        licensePlate: 'ABC-123',
        terminalId: 1,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(tx.fleetUnitSequence.upsert).not.toHaveBeenCalled();
  });

  it('rejects a fleet resource assigned to a missing terminal', async () => {
    tx.terminal.findUnique.mockResolvedValue(null);

    await expect(
      service.createDriver({
        employeeId: 'EMP-200',
        licenseNumber: 'DL-200',
        licenseClass: 'Class 1',
        terminalId: 404,
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(tx.driver.create).not.toHaveBeenCalled();
  });

  it('returns snapshot-backed available resources for resource scheduling', async () => {
    prisma.truckSnapshot.findMany.mockResolvedValue([{ id: 'ts-1', truckId: 'truck-1', currentStatus: 'AVAILABLE', assignedTripId: null, truck: { id: 'truck-1', unitNumber: 'TRK-1' } }]);
    prisma.driverSnapshot.findMany.mockResolvedValue([{ id: 'ds-1', driverId: 'driver-1', currentStatus: 'AVAILABLE', assignedTripId: null, driver: { id: 'driver-1', employeeId: 'DRV-1' } }]);
    prisma.trailerSnapshot.findMany.mockResolvedValue([{ id: 'trailer-1', trailerBarcode: 'TRL-1', currentStatus: 'OPEN' }]);

    const result = await service.getAvailability(7);

    expect(prisma.truckSnapshot.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ currentTerminalId: 7, currentStatus: TruckStatus.AVAILABLE }) }));
    expect(result).toMatchObject({ trucks: [{ id: 'truck-1' }], drivers: [{ id: 'driver-1' }], trailers: [{ id: 'trailer-1' }] });
  });
});
