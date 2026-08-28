import { PackageEventType, TerminalStatus } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/prisma/prisma.service';
import { TerminalService } from '../services/terminal.service';

describe('TerminalService performance reads', () => {
  const prisma = {
    terminal: { findMany: jest.fn(), findUnique: jest.fn() },
    packageEvent: { findMany: jest.fn() },
    tripStop: { findMany: jest.fn() },
    userSnapshot: { findMany: jest.fn() },
  };
  let service: TerminalService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new TerminalService(prisma as unknown as PrismaService);
  });

  it('calculates package and on-time metrics for each terminal and date range', async () => {
    prisma.terminal.findMany.mockResolvedValue([{
      id: 1,
      terminalCode: 'YYC',
      name: 'Calgary-000',
      city: 'Calgary',
      province: 'AB',
      snapshot: { currentStatus: TerminalStatus.ACTIVE, packageCount: 5, containerCount: 2, trailerCount: 1, employeeCount: 3 },
    }]);
    prisma.packageEvent.findMany.mockResolvedValue([
      { terminalId: 1, packageId: 'package-1', eventType: PackageEventType.PACKAGE_RECEIVED, createdAt: new Date('2026-07-10T09:00:00Z'), package: { shipmentPackages: [] } },
      { terminalId: 1, packageId: 'package-1', eventType: PackageEventType.PACKAGE_DELIVERED, createdAt: new Date('2026-07-10T12:00:00Z'), package: { shipmentPackages: [{ shipment: { estimatedDeliveryAt: new Date('2026-07-10T13:00:00Z') } }] } },
      { terminalId: 1, packageId: 'package-2', eventType: PackageEventType.PACKAGE_ATTEMPTED_DELIVERY, createdAt: new Date('2026-07-11T12:00:00Z'), package: { shipmentPackages: [] } },
      { terminalId: 1, packageId: 'package-2', eventType: PackageEventType.PACKAGE_DELIVERED, createdAt: new Date('2026-07-11T14:00:00Z'), package: { shipmentPackages: [{ shipment: { estimatedDeliveryAt: new Date('2026-07-11T13:00:00Z') } }] } },
    ]);
    prisma.tripStop.findMany.mockResolvedValue([
      { terminalId: 1, plannedArrival: new Date('2026-07-10T10:00:00Z'), actualArrival: new Date('2026-07-10T10:00:00Z'), actualDeparture: new Date('2026-07-10T10:15:00Z'), delayMinutes: 0 },
      { terminalId: 1, plannedArrival: new Date('2026-07-11T10:00:00Z'), actualArrival: new Date('2026-07-11T10:15:00Z'), actualDeparture: null, delayMinutes: 15 },
    ]);

    await expect(service.getPerformance({ fromDate: '2026-07-10', toDate: '2026-07-11' })).resolves.toEqual([
      expect.objectContaining({
        terminalCode: 'YYC',
        metrics: {
          packagesProcessed: 2,
          deliveredPackages: 2,
          committedDeliveries: 2,
          onTimeDeliveries: 1,
          deliveryOnTimePerformance: 50,
          lateDeliveries: 1,
          deliveryAttempts: 1,
          totalArrivals: 2,
          onTimeArrivals: 1,
          onTimePerformance: 50,
          lateArrivals: 1,
          inboundTrailers: 2,
          outboundTrailers: 1,
        },
      }),
    ]);
    expect(prisma.packageEvent.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        createdAt: {
          gte: new Date('2026-07-10T00:00:00.000Z'),
          lt: new Date('2026-07-12T00:00:00.000Z'),
        },
      }),
    }));
  });

  it('returns inbound and outbound trailer movements with trip links', async () => {
    prisma.terminal.findUnique.mockResolvedValue({ id: 1, terminalCode: 'YYC', snapshot: {} });
    prisma.tripStop.findMany.mockResolvedValue([{
      id: 'stop-1',
      plannedArrival: new Date('2026-07-10T10:00:00Z'),
      actualArrival: new Date('2026-07-10T10:05:00Z'),
      plannedDeparture: new Date('2026-07-10T10:15:00Z'),
      actualDeparture: new Date('2026-07-10T10:20:00Z'),
      delayMinutes: 5,
      trip: { id: 'trip-1', tripNumber: 'TRIP-100', equipmentAssignments: [{ trailer: { trailerBarcode: 'TRL-100' } }] },
    }]);

    const movements = await service.getMovements(1, { fromDate: '2026-07-10', toDate: '2026-07-10' });

    expect(movements).toEqual([
      expect.objectContaining({ direction: 'OUTBOUND', tripId: 'trip-1', trailerBarcode: 'TRL-100' }),
      expect.objectContaining({ direction: 'INBOUND', tripId: 'trip-1', trailerBarcode: 'TRL-100' }),
    ]);
  });
});
