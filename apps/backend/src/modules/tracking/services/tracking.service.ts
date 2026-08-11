import { Injectable, NotFoundException } from '@nestjs/common';
import { ShipmentEventType } from '@prisma/client';

import { PrismaService } from '../../../infrastructure/prisma/prisma.service';

// Customer tracking shows lifecycle milestones, not internal projection and
// membership events that are intended only for operational auditing.
const CUSTOMER_MILESTONE_TYPES = new Set<ShipmentEventType>([
  ShipmentEventType.SHIPMENT_CREATED,
  ShipmentEventType.SHIPMENT_IN_TRANSIT,
  ShipmentEventType.SHIPMENT_OUT_FOR_DELIVERY,
  ShipmentEventType.SHIPMENT_COMPLETED,
  ShipmentEventType.SHIPMENT_CANCELLED,
]);

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
          include: { package: { include: { snapshot: true } } },
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
      packages: shipment.packages.flatMap(({ package: pkg }) =>
        pkg.snapshot
          ? [{
              trackingNumber: pkg.trackingNumber,
              status: pkg.snapshot.currentStatus,
              lastUpdatedAt: pkg.snapshot.updatedAt,
            }]
          : [],
      ),
      milestones: shipment.events
        .filter((event) => CUSTOMER_MILESTONE_TYPES.has(event.eventType))
        .map((event) => ({
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
