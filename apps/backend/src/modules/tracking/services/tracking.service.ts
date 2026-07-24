import { Injectable, NotFoundException } from '@nestjs/common';

import { PrismaService } from '../../../infrastructure/prisma/prisma.service';

@Injectable()
export class TrackingService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Returns a customer-safe projection. Internal ids, notification recipients,
   * and operational relationship records deliberately stay out of this view.
   */
  async trackShipment(shipmentNumber: string) {
    const shipment = await this.prisma.shipment.findUnique({
      where: { shipmentNumber: shipmentNumber.trim().toUpperCase() },
      include: {
        originTerminal: true,
        destinationTerminal: true,
        snapshot: true,
        packages: {
          include: { package: true },
          orderBy: { package: { trackingNumber: 'asc' } },
        },
        events: { orderBy: { createdAt: 'asc' } },
      },
    });
    if (!shipment?.snapshot) {
      throw new NotFoundException('Shipment not found');
    }

    const currentTerminal = shipment.snapshot.currentTerminalId
      ? await this.prisma.terminal.findUnique({
          where: { id: shipment.snapshot.currentTerminalId },
        })
      : null;

    return {
      shipmentNumber: shipment.shipmentNumber,
      referenceNumber: shipment.referenceNumber,
      status: shipment.snapshot.currentStatus,
      origin: this.terminalSummary(shipment.originTerminal),
      destination: this.terminalSummary(shipment.destinationTerminal),
      currentTerminal: currentTerminal
        ? this.terminalSummary(currentTerminal)
        : null,
      progress: {
        packageCount: shipment.snapshot.packageCount,
        deliveredPackages: shipment.snapshot.deliveredPackages,
        outForDeliveryPackages:
          shipment.snapshot.outForDeliveryPackages,
        remainingPackages: shipment.snapshot.remainingPackages,
        progressPercent: shipment.snapshot.progressPercent,
        completedAt: shipment.snapshot.completedAt,
        lastActivityAt: shipment.snapshot.lastActivityAt,
      },
      packages: shipment.packages.map(({ package: pkg }) => ({
        trackingNumber: pkg.trackingNumber,
        status: pkg.currentStatus,
        lastUpdatedAt: pkg.updatedAt,
      })),
      milestones: shipment.events.map((event) => ({
        type: event.eventType,
        occurredAt: event.createdAt,
      })),
    };
  }

  private terminalSummary(terminal: {
    terminalCode: string;
    name: string;
    city: string;
    province: string;
    country: string;
  }) {
    return {
      terminalCode: terminal.terminalCode,
      name: terminal.name,
      city: terminal.city,
      province: terminal.province,
      country: terminal.country,
    };
  }
}
