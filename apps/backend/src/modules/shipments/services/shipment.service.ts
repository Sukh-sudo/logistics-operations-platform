import { BadRequestException, ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PackageEventType, PackageStatus, Prisma, ShipmentEventType, ShipmentStatus } from '@prisma/client';
import { randomUUID } from 'crypto';
import { PrismaService } from '../../../infrastructure/prisma/prisma.service';
import { NotificationService } from '../../notifications/services/notification.service';
import { CreateShipmentDto } from '../dto/create-shipment.dto';
import { ShipmentPackageDto } from '../dto/shipment-package.dto';
import { UpdateShipmentDto } from '../dto/update-shipment.dto';

type Tx = Prisma.TransactionClient;

@Injectable()
export class ShipmentService {
  private readonly logger = new Logger(ShipmentService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationService: NotificationService,
  ) {}

  async createShipment(dto: CreateShipmentDto, requestId?: string) {
    const correlationId = requestId ?? randomUUID();
    const shipmentNumber = dto.shipmentNumber.trim().toUpperCase();
    if (dto.originTerminalId === dto.destinationTerminalId) {
      throw new BadRequestException('Origin and destination terminals must be different');
    }
    const result = await this.prisma.$transaction(async (tx) => {
      await this.ensureTerminals(tx, [dto.originTerminalId, dto.destinationTerminalId]);
      if (await tx.shipment.findUnique({ where: { shipmentNumber } })) throw new ConflictException('Shipment number already exists');
      const packages = await this.findPackages(tx, dto.packageTrackingNumbers);
      const assigned = await tx.shipmentPackage.findMany({ where: { packageId: { in: packages.map((item) => item.id) } } });
      if (assigned.length) throw new ConflictException('One or more packages already belong to a shipment');
      const shipment = await tx.shipment.create({ data: { shipmentNumber, referenceNumber: dto.referenceNumber?.trim(), notificationRecipient: dto.notificationRecipient?.trim().toLowerCase(), originTerminalId: dto.originTerminalId, destinationTerminalId: dto.destinationTerminalId, status: ShipmentStatus.PACKAGES_ASSIGNED } });
      await tx.shipmentPackage.createMany({ data: packages.map((item) => ({ shipmentId: shipment.id, packageId: item.id })) });
      const event = await tx.shipmentEvent.create({ data: { shipmentId: shipment.id, eventType: ShipmentEventType.SHIPMENT_CREATED, correlationId, payload: { shipmentNumber, originTerminalId: dto.originTerminalId, destinationTerminalId: dto.destinationTerminalId, packageTrackingNumbers: dto.packageTrackingNumbers } } });
      const progress = this.progress(packages);
      const snapshot = await tx.shipmentSnapshot.create({ data: { shipmentId: shipment.id, currentStatus: ShipmentStatus.PACKAGES_ASSIGNED, currentTerminalId: dto.originTerminalId, ...progress, lastActivityAt: event.createdAt } });
      return { shipment, packages, event, snapshot };
    });
    await this.dispatchNotification(result);
    return result;
  }

  getShipments() {
    return this.prisma.shipment.findMany({ include: { snapshot: true, packages: { include: { package: true } } }, orderBy: { shipmentNumber: 'asc' } });
  }

  async getShipment(id: string) {
    const shipment = await this.prisma.shipment.findUnique({ where: { id }, include: { originTerminal: true, destinationTerminal: true, snapshot: true, packages: { include: { package: true } } } });
    if (!shipment) throw new NotFoundException('Shipment not found');
    return shipment;
  }

  async updateShipment(id: string, dto: UpdateShipmentDto, requestId?: string) {
    if (dto.referenceNumber === undefined) throw new BadRequestException('At least one shipment field is required');
    const result = await this.prisma.$transaction(async (tx) => {
      const current = await this.shipmentForMutation(tx, id);
      this.ensureMutable(current.status);
      const shipment = await tx.shipment.update({ where: { id }, data: { referenceNumber: dto.referenceNumber!.trim() } });
      const event = await tx.shipmentEvent.create({ data: { shipmentId: id, eventType: ShipmentEventType.SHIPMENT_UPDATED, correlationId: requestId ?? randomUUID(), payload: { referenceNumber: shipment.referenceNumber } } });
      const snapshot = await tx.shipmentSnapshot.update({ where: { shipmentId: id }, data: { lastActivityAt: event.createdAt } });
      return { shipment, event, snapshot };
    });
    return result;
  }

  async assignPackage(id: string, dto: ShipmentPackageDto, requestId?: string) {
    return this.prisma.$transaction(async (tx) => {
      const current = await this.shipmentForMutation(tx, id);
      this.ensureMutable(current.status);
      const [pkg] = await this.findPackages(tx, [dto.trackingNumber]);
      if (await tx.shipmentPackage.findUnique({ where: { packageId: pkg.id } })) throw new ConflictException('Package already belongs to a shipment');
      await tx.shipmentPackage.create({ data: { shipmentId: id, packageId: pkg.id } });
      const event = await tx.shipmentEvent.create({ data: { shipmentId: id, eventType: ShipmentEventType.PACKAGE_ASSIGNED, correlationId: requestId ?? randomUUID(), payload: { packageId: pkg.id, trackingNumber: pkg.trackingNumber } } });
      const snapshot = await this.refreshSnapshot(tx, id, event.createdAt);
      return { package: pkg, event, snapshot };
    });
  }

  async removePackage(id: string, dto: ShipmentPackageDto, requestId?: string) {
    return this.prisma.$transaction(async (tx) => {
      const current = await this.shipmentForMutation(tx, id);
      this.ensureMutable(current.status);
      if (current.packages.length <= 1) throw new ConflictException('Shipment must contain at least one package');
      const membership = current.packages.find((item) => item.package.trackingNumber === dto.trackingNumber);
      if (!membership) throw new NotFoundException('Package is not assigned to this shipment');
      await tx.shipmentPackage.delete({ where: { shipmentId_packageId: { shipmentId: id, packageId: membership.packageId } } });
      const event = await tx.shipmentEvent.create({ data: { shipmentId: id, eventType: ShipmentEventType.PACKAGE_REMOVED, correlationId: requestId ?? randomUUID(), payload: { packageId: membership.packageId, trackingNumber: dto.trackingNumber } } });
      const snapshot = await this.refreshSnapshot(tx, id, event.createdAt);
      return { removedPackageId: membership.packageId, event, snapshot };
    });
  }

  async completeShipment(id: string, requestId?: string) {
    const result = await this.prisma.$transaction(async (tx) => {
      const current = await this.shipmentForMutation(tx, id);
      this.ensureMutable(current.status);
      if (!current.packages.length || current.packages.some((item) => item.package.currentStatus !== PackageStatus.DELIVERED)) {
        throw new ConflictException('Every package must be delivered before completion');
      }
      const shipment = await tx.shipment.update({ where: { id }, data: { status: ShipmentStatus.COMPLETED } });
      const event = await tx.shipmentEvent.create({ data: { shipmentId: id, eventType: ShipmentEventType.SHIPMENT_COMPLETED, correlationId: requestId ?? randomUUID() } });
      const snapshot = await tx.shipmentSnapshot.update({ where: { shipmentId: id }, data: { currentStatus: ShipmentStatus.COMPLETED, packageCount: current.packages.length, deliveredPackages: current.packages.length, outForDeliveryPackages: 0, remainingPackages: 0, progressPercent: 100, completedAt: event.createdAt, lastActivityAt: event.createdAt } });
      return { shipment, event, snapshot };
    });
    await this.dispatchNotification(result);
    return result;
  }

  async cancelShipment(id: string, requestId?: string) {
    const result = await this.prisma.$transaction(async (tx) => {
      const current = await this.shipmentForMutation(tx, id);
      this.ensureMutable(current.status);
      const shipment = await tx.shipment.update({ where: { id }, data: { status: ShipmentStatus.CANCELLED } });
      const event = await tx.shipmentEvent.create({ data: { shipmentId: id, eventType: ShipmentEventType.SHIPMENT_CANCELLED, correlationId: requestId ?? randomUUID() } });
      const snapshot = await tx.shipmentSnapshot.update({ where: { shipmentId: id }, data: { currentStatus: ShipmentStatus.CANCELLED, lastActivityAt: event.createdAt } });
      return { shipment, event, snapshot };
    });
    await this.dispatchNotification(result);
    return result;
  }

  /**
   * Projects a committed package event into its parent shipment. The package
   * event remains authoritative; this transaction appends shipment history and
   * updates the shipment snapshot used by tracking and reporting.
   */
  async synchronizePackageProgress(
    trackingNumber: string,
    packageEventType: PackageEventType,
    terminalId?: number,
    requestId?: string,
  ) {
    const result = await this.prisma.$transaction(async (tx) => {
      const pkg = await tx.packageSnapshot.findUnique({
        where: { trackingNumber },
      });
      if (!pkg) {
        return null;
      }
      const membership = await tx.shipmentPackage.findUnique({
        where: { packageId: pkg.id },
        include: {
          shipment: {
            include: {
              snapshot: true,
              packages: { include: { package: true } },
            },
          },
        },
      });
      if (!membership?.shipment.snapshot) {
        return null;
      }

      const current = membership.shipment;
      const currentSnapshot = membership.shipment.snapshot;
      if (
        current.status === ShipmentStatus.COMPLETED ||
        current.status === ShipmentStatus.CANCELLED
      ) {
        return null;
      }

      const progress = this.progress(
        current.packages.map((item) => item.package),
      );
      const nextStatus = this.derivedStatus(
        current.packages.map((item) => item.package),
        progress,
      );
      const eventType = this.progressEventType(
        current.status,
        nextStatus,
        packageEventType,
      );
      const event = await tx.shipmentEvent.create({
        data: {
          shipmentId: current.id,
          eventType,
          correlationId: requestId ?? randomUUID(),
          payload: {
            trackingNumber,
            packageEventType,
            packageStatus: pkg.currentStatus,
            terminalId: terminalId ?? null,
          },
        },
      });
      const shipment = await tx.shipment.update({
        where: { id: current.id },
        data: { status: nextStatus },
      });
      const snapshot = await tx.shipmentSnapshot.update({
        where: { shipmentId: current.id },
        data: {
          currentStatus: nextStatus,
          currentTerminalId:
            terminalId ?? currentSnapshot.currentTerminalId,
          ...progress,
          completedAt:
            nextStatus === ShipmentStatus.COMPLETED
              ? event.createdAt
              : currentSnapshot.completedAt,
          lastActivityAt: event.createdAt,
        },
      });
      return { shipment, event, snapshot };
    });

    if (result) {
      await this.dispatchNotification(result);
    }
    return result;
  }

  async getHistory(id: string) {
    await this.getShipment(id);
    return this.prisma.shipmentEvent.findMany({ where: { shipmentId: id }, orderBy: { createdAt: 'asc' } });
  }

  async getPackages(id: string) {
    const shipment = await this.getShipment(id);
    return shipment.packages.map((item) => item.package);
  }

  private async shipmentForMutation(tx: Tx, id: string) {
    const shipment = await tx.shipment.findUnique({ where: { id }, include: { packages: { include: { package: true } }, snapshot: true } });
    if (!shipment) throw new NotFoundException('Shipment not found');
    return shipment;
  }

  private async findPackages(tx: Tx, trackingNumbers: string[]) {
    const packages = await tx.packageSnapshot.findMany({ where: { trackingNumber: { in: trackingNumbers } } });
    if (packages.length !== trackingNumbers.length) throw new NotFoundException('One or more packages were not found');
    return packages;
  }

  private async ensureTerminals(tx: Tx, ids: number[]) {
    const terminals = await tx.terminal.findMany({ where: { id: { in: ids } }, select: { id: true } });
    if (terminals.length !== new Set(ids).size) throw new NotFoundException('One or more terminals were not found');
  }

  private async refreshSnapshot(tx: Tx, shipmentId: string, lastActivityAt: Date) {
    const memberships = await tx.shipmentPackage.findMany({ where: { shipmentId }, include: { package: true } });
    const progress = this.progress(memberships.map((item) => item.package));
    const status = progress.deliveredPackages > 0 ? ShipmentStatus.PARTIALLY_DELIVERED : ShipmentStatus.PACKAGES_ASSIGNED;
    await tx.shipment.update({ where: { id: shipmentId }, data: { status } });
    return tx.shipmentSnapshot.update({ where: { shipmentId }, data: { currentStatus: status, ...progress, lastActivityAt } });
  }

  private progress(packages: Array<{ currentStatus: PackageStatus }>) {
    const deliveredPackages = packages.filter((item) => item.currentStatus === PackageStatus.DELIVERED).length;
    const outForDeliveryPackages = packages.filter((item) => item.currentStatus === PackageStatus.OUT_FOR_DELIVERY).length;
    return { packageCount: packages.length, deliveredPackages, outForDeliveryPackages, remainingPackages: packages.length - deliveredPackages, progressPercent: packages.length ? Math.floor(deliveredPackages * 100 / packages.length) : 0 };
  }

  private derivedStatus(
    packages: Array<{ currentStatus: PackageStatus }>,
    progress: ReturnType<ShipmentService['progress']>,
  ) {
    if (progress.packageCount > 0 && progress.remainingPackages === 0) {
      return ShipmentStatus.COMPLETED;
    }
    if (progress.deliveredPackages > 0) {
      return ShipmentStatus.PARTIALLY_DELIVERED;
    }
    const movingStatuses: PackageStatus[] = [
      PackageStatus.DEPARTED,
      PackageStatus.ARRIVED,
      PackageStatus.OUT_FOR_DELIVERY,
    ];
    if (packages.some((item) => movingStatuses.includes(item.currentStatus))) {
      return ShipmentStatus.IN_TRANSIT;
    }
    return ShipmentStatus.PACKAGES_ASSIGNED;
  }

  private progressEventType(
    currentStatus: ShipmentStatus,
    nextStatus: ShipmentStatus,
    packageEventType: PackageEventType,
  ) {
    if (nextStatus === ShipmentStatus.COMPLETED) {
      return ShipmentEventType.SHIPMENT_COMPLETED;
    }
    if (packageEventType === PackageEventType.PACKAGE_OUT_FOR_DELIVERY) {
      return ShipmentEventType.SHIPMENT_OUT_FOR_DELIVERY;
    }
    if (
      nextStatus === ShipmentStatus.IN_TRANSIT &&
      currentStatus !== ShipmentStatus.IN_TRANSIT
    ) {
      return ShipmentEventType.SHIPMENT_IN_TRANSIT;
    }
    return ShipmentEventType.SHIPMENT_PROGRESS_UPDATED;
  }

  /**
   * Notification delivery starts only after the shipment transaction commits.
   * A notification failure is logged and never rolls back operational state.
   */
  private async dispatchNotification(source: {
    shipment: {
      id: string;
      shipmentNumber: string;
      referenceNumber: string | null;
      notificationRecipient: string | null;
    };
    event: {
      id: string;
      eventType: ShipmentEventType;
      correlationId: string;
    };
  }) {
    try {
      await this.notificationService.createFromShipmentEvent(source);
    } catch (error) {
      this.logger.error(
        `Notification generation failed for shipment event ${source.event.id}`,
        error instanceof Error ? error.stack : undefined,
      );
    }
  }

  private ensureMutable(status: ShipmentStatus) {
    if (status === ShipmentStatus.COMPLETED || status === ShipmentStatus.CANCELLED) throw new ConflictException('Completed or cancelled shipments cannot be modified');
  }
}
