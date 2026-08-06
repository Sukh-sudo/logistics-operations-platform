import { BadRequestException } from '@nestjs/common';
import { PackageStatus, TrailerStatus } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/prisma/prisma.service';
import { DashboardService } from '../services/dashboard.service';

describe('DashboardService filters', () => {
  const prisma = {
    packageSnapshot: { count: jest.fn(), findMany: jest.fn() },
    containerSnapshot: { count: jest.fn(), findMany: jest.fn() },
    trailerSnapshot: { count: jest.fn(), findMany: jest.fn(), findUnique: jest.fn() },
    packageEvent: { findMany: jest.fn() },
    containerEvent: { findMany: jest.fn() },
    trailerEvent: { findMany: jest.fn() },
    handheldTaskSession: { findMany: jest.fn() },
    handheldCommandReceipt: {
      groupBy: jest.fn(),
      count: jest.fn(),
      aggregate: jest.fn(),
    },
  };
  let service: DashboardService;

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.packageSnapshot.count.mockResolvedValue(1);
    prisma.containerSnapshot.count.mockResolvedValue(1);
    prisma.trailerSnapshot.count.mockResolvedValue(1);
    prisma.packageSnapshot.findMany.mockResolvedValue([]);
    prisma.containerSnapshot.findMany.mockResolvedValue([]);
    prisma.trailerSnapshot.findMany.mockResolvedValue([]);
    prisma.trailerSnapshot.findUnique.mockResolvedValue(null);
    prisma.packageEvent.findMany.mockResolvedValue([]);
    prisma.containerEvent.findMany.mockResolvedValue([]);
    prisma.trailerEvent.findMany.mockResolvedValue([]);
    prisma.handheldTaskSession.findMany.mockResolvedValue([]);
    prisma.handheldCommandReceipt.groupBy.mockResolvedValue([]);
    prisma.handheldCommandReceipt.count.mockResolvedValue(0);
    prisma.handheldCommandReceipt.aggregate.mockResolvedValue({
      _sum: { duplicateCount: 0 },
    });
    service = new DashboardService(prisma as unknown as PrismaService);
  });

  it('combines inclusive dates, terminal, and statuses in snapshot counts', async () => {
    const result = await service.getSummary({
      fromDate: '2026-07-01',
      toDate: '2026-07-02',
      terminalId: 7,
      packageStatus: PackageStatus.DELIVERED,
      trailerStatus: TrailerStatus.CLOSED,
    });

    expect(prisma.packageSnapshot.count).toHaveBeenCalledTimes(1);
    expect(prisma.packageSnapshot.count).toHaveBeenCalledWith({
      where: {
        currentStatus: PackageStatus.DELIVERED,
        currentTerminalId: 7,
        updatedAt: {
          gte: new Date('2026-07-01T00:00:00.000Z'),
          lt: new Date('2026-07-03T00:00:00.000Z'),
        },
      },
    });
    expect(prisma.trailerSnapshot.count).toHaveBeenCalledTimes(1);
    expect(prisma.trailerSnapshot.count).toHaveBeenCalledWith({
      where: expect.objectContaining({
        currentStatus: TrailerStatus.CLOSED,
        currentTerminalId: 7,
      }),
    });
    expect(result.packages).toEqual(expect.objectContaining({ delivered: 1, received: 0 }));
    expect(result.trailers).toEqual(expect.objectContaining({ closed: 1, open: 0 }));
  });

  it('filters each event stream through its current snapshot relation', async () => {
    await service.getRecentEvents({
      fromDate: '2026-07-10',
      terminalId: 3,
      packageStatus: PackageStatus.IN_TRAILER,
      trailerStatus: TrailerStatus.IN_TRANSIT,
    });

    expect(prisma.packageEvent.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: {
        createdAt: { gte: new Date('2026-07-10T00:00:00.000Z') },
        package: {
          snapshot: {
            currentTerminalId: 3,
            currentStatus: PackageStatus.IN_TRAILER,
          },
        },
      },
    }));
    expect(prisma.containerEvent.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        container: { snapshot: { currentTerminalId: 3 } },
      }),
    }));
    expect(prisma.trailerEvent.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        trailer: {
          snapshot: {
            currentTerminalId: 3,
            currentStatus: TrailerStatus.IN_TRANSIT,
          },
        },
      }),
    }));
  });

  it('rejects an inverted date range before querying Prisma', async () => {
    await expect(service.getSummary({ fromDate: '2026-07-03', toDate: '2026-07-02' }))
      .rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.packageSnapshot.count).not.toHaveBeenCalled();
  });

  it('combines package date, lane, and status filters', async () => {
    await service.getPackages({
      fromDate: '2026-07-01',
      toDate: '2026-07-02',
      originTerminalId: 1,
      destinationTerminalId: 2,
      status: PackageStatus.IN_TRAILER,
    });

    expect(prisma.packageSnapshot.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: {
        updatedAt: {
          gte: new Date('2026-07-01T00:00:00.000Z'),
          lt: new Date('2026-07-03T00:00:00.000Z'),
        },
        currentStatus: PackageStatus.IN_TRAILER,
        aggregate: {
          shipmentPackages: {
            some: { shipment: { originTerminalId: 1, destinationTerminalId: 2 } },
          },
        },
      },
    }));
  });

  it('returns package snapshot dates and shipment lanes', async () => {
    prisma.packageSnapshot.findMany.mockResolvedValue([{
      trackingNumber: 'PKG000000001',
      currentStatus: PackageStatus.IN_CONTAINER,
      currentContainerId: 'container-1',
      currentTrailerId: null,
      updatedAt: new Date('2026-07-10T12:00:00.000Z'),
      aggregate: {
        shipmentPackages: [{ shipment: { originTerminalId: 1, destinationTerminalId: 2 } }],
      },
    }]);
    prisma.containerSnapshot.findMany.mockResolvedValue([{
      id: 'container-1',
      containerBarcode: 'CONT000001',
      currentTrailerId: 'trailer-1',
    }]);
    prisma.trailerSnapshot.findMany.mockResolvedValue([{
      id: 'trailer-1',
      trailerBarcode: 'TRLR000001',
    }]);

    await expect(service.getPackages()).resolves.toEqual([{
      trackingNumber: 'PKG000000001',
      status: PackageStatus.IN_CONTAINER,
      containerBarcode: 'CONT000001',
      trailerBarcode: 'TRLR000001',
      updatedAt: '2026-07-10T12:00:00.000Z',
      originTerminalId: 1,
      destinationTerminalId: 2,
    }]);
  });

  it('calculates terminal PPH from accepted scans and aggregate active time', async () => {
    prisma.handheldTaskSession.findMany.mockResolvedValue([
      {
        id: 'session-1',
        employeeId: 'employee-1',
        snapshot: { currentState: 'ACTIVE' },
        intervals: [
          {
            startedAt: new Date('2026-07-28T10:00:00Z'),
            endedAt: new Date('2026-07-28T11:00:00Z'),
          },
        ],
      },
    ]);
    prisma.handheldCommandReceipt.count.mockResolvedValue(24);
    prisma.handheldCommandReceipt.aggregate.mockResolvedValue({
      _sum: { duplicateCount: 2 },
    });
    prisma.handheldCommandReceipt.groupBy.mockResolvedValue([
      { resultStatus: 'REJECTED', _count: { _all: 3 } },
    ]);

    const result = await service.getHandheldKpis({ terminalId: 7 });

    expect(result).toMatchObject({
      acceptedPackages: 24,
      rejectedScans: 3,
      duplicateScans: 2,
      activeEmployees: 1,
      activeSeconds: 3600,
      terminalPackagesPerHour: 24,
    });
  });
});
