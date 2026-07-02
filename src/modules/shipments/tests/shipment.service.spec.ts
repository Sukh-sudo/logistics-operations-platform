import { BadRequestException, ConflictException } from '@nestjs/common';
import { PackageStatus, ShipmentEventType, ShipmentStatus } from '@prisma/client';
import { ShipmentService } from '../services/shipment.service';

describe('ShipmentService', () => {
  const tx = {
    terminal: { findMany: jest.fn() }, shipment: { findUnique: jest.fn(), create: jest.fn(), update: jest.fn() },
    packageSnapshot: { findMany: jest.fn() }, shipmentPackage: { findMany: jest.fn(), createMany: jest.fn() },
    shipmentEvent: { create: jest.fn() }, shipmentSnapshot: { create: jest.fn(), update: jest.fn() },
  };
  const prisma = { $transaction: jest.fn((callback) => callback(tx)), shipment: { findMany: jest.fn(), findUnique: jest.fn() } };
  let service: ShipmentService;

  beforeEach(() => { jest.clearAllMocks(); service = new ShipmentService(prisma as never); });

  it('creates package membership, an event, and snapshot in one transaction', async () => {
    const createdAt = new Date();
    tx.terminal.findMany.mockResolvedValue([{ id: 1 }, { id: 2 }]); tx.shipment.findUnique.mockResolvedValue(null);
    tx.packageSnapshot.findMany.mockResolvedValue([{ id: 'p1', trackingNumber: 'PKG-1', currentStatus: PackageStatus.RECEIVED }]);
    tx.shipmentPackage.findMany.mockResolvedValue([]); tx.shipment.create.mockResolvedValue({ id: 'sh1', status: ShipmentStatus.PACKAGES_ASSIGNED });
    tx.shipmentEvent.create.mockResolvedValue({ eventType: ShipmentEventType.SHIPMENT_CREATED, createdAt });
    tx.shipmentSnapshot.create.mockResolvedValue({ packageCount: 1, currentStatus: ShipmentStatus.PACKAGES_ASSIGNED });
    const result = await service.createShipment({ shipmentNumber: 'S-1', originTerminalId: 1, destinationTerminalId: 2, packageTrackingNumbers: ['PKG-1'] });
    expect(tx.shipmentPackage.createMany).toHaveBeenCalledWith({ data: [{ shipmentId: 'sh1', packageId: 'p1' }] });
    expect(tx.shipmentEvent.create).toHaveBeenCalledWith({ data: expect.objectContaining({ eventType: ShipmentEventType.SHIPMENT_CREATED }) });
    expect(result.snapshot.packageCount).toBe(1);
  });

  it('requires distinct origin and destination terminals', async () => {
    await expect(service.createShipment({ shipmentNumber: 'S-2', originTerminalId: 1, destinationTerminalId: 1, packageTrackingNumbers: ['PKG-1'] })).rejects.toBeInstanceOf(BadRequestException);
  });
});
