import { BadRequestException, ConflictException } from '@nestjs/common';
import { PackageEventType, PackageStatus, ShipmentEventType, ShipmentStatus } from '@prisma/client';
import { ShipmentService } from '../services/shipment.service';

describe('ShipmentService', () => {
  const tx = {
    terminal: { findMany: jest.fn() }, shipment: { findUnique: jest.fn(), create: jest.fn(), update: jest.fn() },
    packageSnapshot: { findMany: jest.fn() }, shipmentPackage: { findMany: jest.fn(), createMany: jest.fn() },
    shipmentEvent: { create: jest.fn() }, shipmentSnapshot: { create: jest.fn(), update: jest.fn() },
  };
  const prisma = { $transaction: jest.fn((callback) => callback(tx)), shipment: { findMany: jest.fn(), findUnique: jest.fn() } };
  const notifications = { createFromShipmentEvent: jest.fn() };
  let service: ShipmentService;

  beforeEach(() => { jest.clearAllMocks(); notifications.createFromShipmentEvent.mockResolvedValue(null); service = new ShipmentService(prisma as never, notifications as never); });

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
    expect(notifications.createFromShipmentEvent).toHaveBeenCalled();
  });

  it('requires distinct origin and destination terminals', async () => {
    await expect(service.createShipment({ shipmentNumber: 'S-2', originTerminalId: 1, destinationTerminalId: 1, packageTrackingNumbers: ['PKG-1'] })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('projects package delivery into a shipment event and snapshot', async () => {
    const createdAt = new Date();
    tx.packageSnapshot.findUnique = jest.fn().mockResolvedValue({
      id: 'p1',
      trackingNumber: 'PKG-1',
      currentStatus: PackageStatus.DELIVERED,
    });
    tx.shipmentPackage.findUnique = jest.fn().mockResolvedValue({
      shipment: {
        id: 'sh1',
        shipmentNumber: 'S-1',
        referenceNumber: null,
        notificationRecipient: 'customer@example.com',
        status: ShipmentStatus.IN_TRANSIT,
        snapshot: {
          currentTerminalId: 1,
          completedAt: null,
        },
        packages: [
          {
            package: {
              currentStatus: PackageStatus.DELIVERED,
            },
          },
        ],
      },
    });
    tx.shipmentEvent.create.mockResolvedValue({
      id: 'se1',
      eventType: ShipmentEventType.SHIPMENT_COMPLETED,
      correlationId: 'request-1',
      createdAt,
    });
    tx.shipment.update.mockResolvedValue({
      id: 'sh1',
      shipmentNumber: 'S-1',
      referenceNumber: null,
      notificationRecipient: 'customer@example.com',
      status: ShipmentStatus.COMPLETED,
    });
    tx.shipmentSnapshot.update.mockResolvedValue({
      currentStatus: ShipmentStatus.COMPLETED,
      progressPercent: 100,
    });

    const result = await service.synchronizePackageProgress(
      'PKG-1',
      PackageEventType.PACKAGE_DELIVERED,
      2,
      'request-1',
    );

    expect(tx.shipmentEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        eventType: ShipmentEventType.SHIPMENT_COMPLETED,
      }),
    });
    expect(tx.shipmentSnapshot.update).toHaveBeenCalledWith({
      where: { shipmentId: 'sh1' },
      data: expect.objectContaining({
        currentStatus: ShipmentStatus.COMPLETED,
        currentTerminalId: 2,
        completedAt: createdAt,
        progressPercent: 100,
      }),
    });
    expect(result?.snapshot.progressPercent).toBe(100);
    expect(notifications.createFromShipmentEvent).toHaveBeenCalled();
  });
});
