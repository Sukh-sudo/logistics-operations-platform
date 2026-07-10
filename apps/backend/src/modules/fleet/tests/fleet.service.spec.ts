import { ConflictException, NotFoundException } from '@nestjs/common';
import { DriverStatus, FleetEventType, TruckStatus } from '@prisma/client';
import { FleetService } from '../services/fleet.service';

describe('FleetService', () => {
  const tx = {
    terminal: { findUnique: jest.fn() },
    truck: { create: jest.fn(), findFirst: jest.fn() },
    driver: { create: jest.fn(), findFirst: jest.fn() },
    fleetEvent: { create: jest.fn() },
    truckSnapshot: { create: jest.fn() },
    driverSnapshot: { create: jest.fn() },
  };
  const prisma = {
    $transaction: jest.fn((callback) => callback(tx)),
    truck: { findMany: jest.fn(), findUnique: jest.fn() },
    driver: { findMany: jest.fn(), findUnique: jest.fn() },
  };
  let service: FleetService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new FleetService(prisma as never);
  });

  it('creates a truck, fleet event, and truck snapshot in one transaction', async () => {
    const createdAt = new Date();
    tx.terminal.findUnique.mockResolvedValue({ id: 1 });
    tx.truck.findFirst.mockResolvedValue(null);
    tx.truck.create.mockResolvedValue({
      id: 'truck-1',
      unitNumber: 'TRK-100',
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
      unitNumber: ' trk-100 ',
      licensePlate: ' abc-123 ',
      terminalId: 1,
      year: 2024,
      make: 'Freightliner',
      model: 'Cascadia',
    });

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(tx.truck.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        unitNumber: 'TRK-100',
        licensePlate: 'ABC-123',
        status: TruckStatus.AVAILABLE,
      }),
    });
    expect(tx.fleetEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        truckId: 'truck-1',
        eventType: FleetEventType.TRUCK_CREATED,
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

  it('rejects duplicate truck identifiers before creating records', async () => {
    tx.truck.findFirst.mockResolvedValue({
      id: 'truck-1',
      unitNumber: 'TRK-100',
      licensePlate: 'XYZ-999',
    });

    await expect(
      service.createTruck({ unitNumber: 'TRK-100', licensePlate: 'ABC-123' }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(tx.truck.create).not.toHaveBeenCalled();
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
});
