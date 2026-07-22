import { BadRequestException } from '@nestjs/common';
import { PackageStatus, TrailerStatus } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/prisma/prisma.service';
import { DashboardService } from '../services/dashboard.service';

describe('DashboardService filters', () => {
  const prisma = {
    packageSnapshot: { count: jest.fn() },
    containerSnapshot: { count: jest.fn() },
    trailerSnapshot: { count: jest.fn() },
    packageEvent: { findMany: jest.fn() },
    containerEvent: { findMany: jest.fn() },
    trailerEvent: { findMany: jest.fn() },
  };
  let service: DashboardService;

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.packageSnapshot.count.mockResolvedValue(1);
    prisma.containerSnapshot.count.mockResolvedValue(1);
    prisma.trailerSnapshot.count.mockResolvedValue(1);
    prisma.packageEvent.findMany.mockResolvedValue([]);
    prisma.containerEvent.findMany.mockResolvedValue([]);
    prisma.trailerEvent.findMany.mockResolvedValue([]);
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
        package: { currentTerminalId: 3, currentStatus: PackageStatus.IN_TRAILER },
      },
    }));
    expect(prisma.containerEvent.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ container: { currentTerminalId: 3 } }),
    }));
    expect(prisma.trailerEvent.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ trailer: { currentTerminalId: 3, currentStatus: TrailerStatus.IN_TRANSIT } }),
    }));
  });

  it('rejects an inverted date range before querying Prisma', async () => {
    await expect(service.getSummary({ fromDate: '2026-07-03', toDate: '2026-07-02' }))
      .rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.packageSnapshot.count).not.toHaveBeenCalled();
  });
});
