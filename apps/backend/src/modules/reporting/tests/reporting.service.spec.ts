import { BadRequestException } from '@nestjs/common';
import { ShipmentStatus } from '@prisma/client';

import { ReportingService } from '../services/reporting.service';

describe('ReportingService', () => {
  const prisma = { shipment: { findMany: jest.fn() } };
  let service: ReportingService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new ReportingService(prisma as never);
  });

  it('aggregates delivery performance from shipment snapshots', async () => {
    prisma.shipment.findMany.mockResolvedValue([
      {
        shipmentNumber: 'SHIP-1',
        createdAt: new Date('2026-07-01T12:00:00Z'),
        snapshot: {
          currentStatus: ShipmentStatus.COMPLETED,
          packageCount: 2,
          deliveredPackages: 2,
          progressPercent: 100,
          completedAt: new Date('2026-07-02T12:00:00Z'),
        },
      },
      {
        shipmentNumber: 'SHIP-2',
        createdAt: new Date('2026-07-03T12:00:00Z'),
        snapshot: {
          currentStatus: ShipmentStatus.IN_TRANSIT,
          packageCount: 1,
          deliveredPackages: 0,
          progressPercent: 0,
          completedAt: null,
        },
      },
    ]);

    const report = await service.getDeliveryReport({
      fromDate: '2026-07-01',
      toDate: '2026-07-31',
    });

    expect(report.totals).toMatchObject({
      totalShipments: 2,
      completedShipments: 1,
      activeShipments: 1,
      totalPackages: 3,
      deliveredPackages: 2,
      completionRate: 50,
    });
    expect(report.statusBreakdown.COMPLETED).toBe(1);
  });

  it('rejects an inverted report date range', async () => {
    await expect(
      service.getDeliveryReport({
        fromDate: '2026-07-31',
        toDate: '2026-07-01',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
