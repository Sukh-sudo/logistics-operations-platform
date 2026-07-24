import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma, ShipmentStatus } from '@prisma/client';

import { PrismaService } from '../../../infrastructure/prisma/prisma.service';
import { DeliveryReportQueryDto } from '../dto/delivery-report-query.dto';

@Injectable()
export class ReportingService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Delivery reports are read-only aggregations over shipment snapshots. The
   * operational event streams remain the source of truth.
   */
  async getDeliveryReport(query: DeliveryReportQueryDto = {}) {
    const createdAt = this.dateRange(query);
    const shipments = await this.prisma.shipment.findMany({
      where: {
        ...(createdAt && { createdAt }),
        ...(query.originTerminalId && {
          originTerminalId: query.originTerminalId,
        }),
        ...(query.destinationTerminalId && {
          destinationTerminalId: query.destinationTerminalId,
        }),
      },
      select: {
        shipmentNumber: true,
        createdAt: true,
        snapshot: true,
      },
      orderBy: { createdAt: 'asc' },
    });

    const statuses = Object.values(ShipmentStatus).reduce(
      (result, status) => ({ ...result, [status]: 0 }),
      {} as Record<ShipmentStatus, number>,
    );
    for (const shipment of shipments) {
      if (shipment.snapshot) {
        statuses[shipment.snapshot.currentStatus] += 1;
      }
    }

    const completedShipments = statuses[ShipmentStatus.COMPLETED];
    const totalShipments = shipments.length;
    return {
      filters: {
        fromDate: query.fromDate ?? null,
        toDate: query.toDate ?? null,
        originTerminalId: query.originTerminalId ?? null,
        destinationTerminalId: query.destinationTerminalId ?? null,
      },
      totals: {
        totalShipments,
        completedShipments,
        activeShipments:
          totalShipments -
          completedShipments -
          statuses[ShipmentStatus.CANCELLED],
        cancelledShipments: statuses[ShipmentStatus.CANCELLED],
        totalPackages: shipments.reduce(
          (sum, shipment) => sum + (shipment.snapshot?.packageCount ?? 0),
          0,
        ),
        deliveredPackages: shipments.reduce(
          (sum, shipment) =>
            sum + (shipment.snapshot?.deliveredPackages ?? 0),
          0,
        ),
        completionRate:
          totalShipments === 0
            ? 0
            : Math.round((completedShipments / totalShipments) * 100),
      },
      statusBreakdown: statuses,
      deliveries: shipments.map((shipment) => ({
        shipmentNumber: shipment.shipmentNumber,
        status: shipment.snapshot?.currentStatus ?? null,
        packageCount: shipment.snapshot?.packageCount ?? 0,
        deliveredPackages:
          shipment.snapshot?.deliveredPackages ?? 0,
        progressPercent: shipment.snapshot?.progressPercent ?? 0,
        createdAt: shipment.createdAt,
        completedAt: shipment.snapshot?.completedAt ?? null,
      })),
    };
  }

  private dateRange(
    query: Pick<DeliveryReportQueryDto, 'fromDate' | 'toDate'>,
  ): Prisma.DateTimeFilter | undefined {
    if (query.fromDate && query.toDate && query.fromDate > query.toDate) {
      throw new BadRequestException(
        'fromDate must be on or before toDate',
      );
    }
    if (!query.fromDate && !query.toDate) {
      return undefined;
    }

    const range: Prisma.DateTimeFilter = {};
    if (query.fromDate) {
      range.gte = new Date(`${query.fromDate}T00:00:00.000Z`);
    }
    if (query.toDate) {
      const exclusiveEnd = new Date(`${query.toDate}T00:00:00.000Z`);
      exclusiveEnd.setUTCDate(exclusiveEnd.getUTCDate() + 1);
      range.lt = exclusiveEnd;
    }
    return range;
  }
}
