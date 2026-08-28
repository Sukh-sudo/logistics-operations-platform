import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  PackageEventType,
  Prisma,
  TerminalAssetType,
  TerminalEventType,
  TerminalStatus,
} from '@prisma/client';
import { randomUUID } from 'crypto';
import { PrismaService } from '../../../infrastructure/prisma/prisma.service';
import { CreateTerminalDto } from '../dto/create-terminal.dto';
import {
  ReceiveTerminalAssetDto,
  TransferTerminalAssetDto,
} from '../dto/terminal-asset.dto';
import { TerminalPerformanceQueryDto } from '../dto/terminal-performance-query.dto';
import { UpdateTerminalDto } from '../dto/update-terminal.dto';

type TransactionClient = Prisma.TransactionClient;

interface AssetMovement {
  rootId: string;
  packages: Array<{
    id: string;
    currentTerminalId: number | null;
  }>;
  containers: Array<{
    id: string;
    currentTerminalId: number | null;
  }>;
  trailers: Array<{
    id: string;
    currentTerminalId: number | null;
  }>;
}

@Injectable()
export class TerminalService {
  constructor(private readonly prisma: PrismaService) {}

  async createTerminal(dto: CreateTerminalDto, requestId?: string) {
    const correlationId = requestId ?? randomUUID();
    const terminalCode = this.normalizeCode(dto.terminalCode);
    const city = this.normalizeText(dto.city);

    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.terminal.findUnique({
        where: { terminalCode },
      });

      if (existing) {
        throw new ConflictException('Terminal code already exists');
      }

      const name = await this.nextTerminalName(tx, city);

      const terminal = await tx.terminal.create({
        data: {
          terminalCode,
          name,
          city,
          province: dto.province.trim(),
          country: dto.country.trim(),
          timezone: dto.timezone.trim(),
        },
      });

      const event = await tx.terminalEvent.create({
        data: {
          terminalId: terminal.id,
          eventType: TerminalEventType.TERMINAL_CREATED,
          correlationId,
          payload: {
            terminalCode,
            name: terminal.name,
            city: terminal.city,
            province: terminal.province,
            country: terminal.country,
            timezone: terminal.timezone,
            status: dto.status ?? TerminalStatus.ACTIVE,
          },
        },
      });

      const snapshot = await tx.terminalSnapshot.create({
        data: {
          terminalId: terminal.id,
          currentStatus: dto.status ?? TerminalStatus.ACTIVE,
          lastActivityAt: event.createdAt,
        },
      });

      return { terminal, snapshot, event };
    });
  }

  async updateTerminal(
    terminalId: number,
    dto: UpdateTerminalDto,
    requestId?: string,
  ) {
    if (Object.values(dto).every((value) => value === undefined)) {
      throw new BadRequestException('At least one terminal field is required');
    }

    const correlationId = requestId ?? randomUUID();

    return this.prisma.$transaction(async (tx) => {
      const current = await this.getTerminalWithSnapshot(tx, terminalId);
      const city = dto.city === undefined
        ? undefined
        : this.normalizeText(dto.city);
      const name = city === undefined
        ? undefined
        : await this.nameForCityUpdate(tx, current.city, current.name, city);

      const terminal = await tx.terminal.update({
        where: { id: terminalId },
        data: {
          terminalCode:
            dto.terminalCode === undefined
              ? undefined
              : this.normalizeCode(dto.terminalCode),
          // A city change allocates a new name in that city's sequence so a
          // free-form update can never break the City-000 naming convention.
          name,
          city,
          province: dto.province?.trim(),
          country: dto.country?.trim(),
          timezone: dto.timezone?.trim(),
        },
      });

      const event = await tx.terminalEvent.create({
        data: {
          terminalId,
          eventType: TerminalEventType.TERMINAL_UPDATED,
          correlationId,
          payload: this.toJson({ ...dto, ...(name && { name }) }),
        },
      });

      const snapshot = await tx.terminalSnapshot.update({
        where: { terminalId },
        data: {
          currentStatus: dto.status,
          lastActivityAt: event.createdAt,
        },
      });

      return { terminal, snapshot, event };
    });
  }

  async getTerminals() {
    return this.prisma.terminal.findMany({
      include: { snapshot: true },
      orderBy: { terminalCode: 'asc' },
    });
  }

  async getPerformance(filters: TerminalPerformanceQueryDto = {}) {
    const dateRange = this.activityDateRange(filters);
    const [terminals, packageEvents, tripStops] = await Promise.all([
      this.prisma.terminal.findMany({
        where: filters.terminalId === undefined ? undefined : { id: filters.terminalId },
        include: { snapshot: true },
        orderBy: { terminalCode: 'asc' },
      }),
      this.prisma.packageEvent.findMany({
        where: {
          terminalId: filters.terminalId ?? { not: null },
          ...(dateRange && { createdAt: dateRange }),
        },
        select: {
          terminalId: true,
          packageId: true,
          eventType: true,
          createdAt: true,
          package: {
            select: {
              shipmentPackages: {
                select: {
                  shipment: { select: { estimatedDeliveryAt: true } },
                },
              },
            },
          },
        },
      }),
      this.prisma.tripStop.findMany({
        where: {
          ...(filters.terminalId !== undefined && { terminalId: filters.terminalId }),
          OR: [
            { actualArrival: dateRange ?? { not: null } },
            { actualDeparture: dateRange ?? { not: null } },
          ],
        },
        select: {
          terminalId: true,
          plannedArrival: true,
          actualArrival: true,
          actualDeparture: true,
          delayMinutes: true,
        },
      }),
    ]);

    return terminals.map((terminal) => {
      const terminalPackageEvents = packageEvents.filter(
        (event) => event.terminalId === terminal.id,
      );
      const terminalStops = tripStops.filter(
        (stop) => stop.terminalId === terminal.id,
      );
      const arrivals = terminalStops.filter(
        (stop) => this.dateIsInRange(stop.actualArrival, filters),
      );
      const departures = terminalStops.filter(
        (stop) => this.dateIsInRange(stop.actualDeparture, filters),
      );
      const onTimeArrivals = arrivals.filter(
        (stop) =>
          this.delayMinutes(stop.plannedArrival, stop.actualArrival!) === 0,
      ).length;
      const committedDeliveries = terminalPackageEvents.flatMap((event) => {
        if (event.eventType !== PackageEventType.PACKAGE_DELIVERED) return [];
        const estimatedDeliveryAt =
          event.package.shipmentPackages[0]?.shipment.estimatedDeliveryAt;
        return estimatedDeliveryAt
          ? [{ deliveredAt: event.createdAt, estimatedDeliveryAt }]
          : [];
      });
      const onTimeDeliveries = committedDeliveries.filter(
        (delivery) => delivery.deliveredAt <= delivery.estimatedDeliveryAt,
      ).length;

      return {
        id: terminal.id,
        terminalCode: terminal.terminalCode,
        name: terminal.name,
        city: terminal.city,
        province: terminal.province,
        currentStatus: terminal.snapshot?.currentStatus ?? null,
        inventory: {
          packages: terminal.snapshot?.packageCount ?? 0,
          containers: terminal.snapshot?.containerCount ?? 0,
          trailers: terminal.snapshot?.trailerCount ?? 0,
          employees: terminal.snapshot?.employeeCount ?? 0,
        },
        metrics: {
          packagesProcessed: new Set(
            terminalPackageEvents.map((event) => event.packageId),
          ).size,
          deliveredPackages: terminalPackageEvents.filter(
            (event) => event.eventType === PackageEventType.PACKAGE_DELIVERED,
          ).length,
          committedDeliveries: committedDeliveries.length,
          onTimeDeliveries,
          deliveryOnTimePerformance:
            committedDeliveries.length === 0
              ? null
              : Math.round(
                  (onTimeDeliveries / committedDeliveries.length) * 100,
                ),
          lateDeliveries: committedDeliveries.length - onTimeDeliveries,
          deliveryAttempts: terminalPackageEvents.filter(
            (event) =>
              event.eventType === PackageEventType.PACKAGE_ATTEMPTED_DELIVERY,
          ).length,
          totalArrivals: arrivals.length,
          onTimeArrivals,
          onTimePerformance:
            arrivals.length === 0
              ? null
              : Math.round((onTimeArrivals / arrivals.length) * 100),
          lateArrivals: arrivals.length - onTimeArrivals,
          inboundTrailers: arrivals.length,
          outboundTrailers: departures.length,
        },
      };
    });
  }

  async getEmployees(terminalId: number) {
    await this.getTerminal(terminalId);
    return this.prisma.userSnapshot.findMany({
      where: { currentTerminalId: terminalId },
      select: {
        id: true,
        employeeNumber: true,
        email: true,
        firstName: true,
        lastName: true,
        currentStatus: true,
        roleNames: true,
        lastActivityAt: true,
      },
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
    });
  }

  async getMovements(
    terminalId: number,
    filters: TerminalPerformanceQueryDto = {},
  ) {
    await this.getTerminal(terminalId);
    const dateRange = this.activityDateRange(filters);
    const stops = await this.prisma.tripStop.findMany({
      where: {
        terminalId,
        OR: [
          { actualArrival: dateRange ?? { not: null } },
          { actualDeparture: dateRange ?? { not: null } },
        ],
      },
      select: {
        id: true,
        plannedArrival: true,
        actualArrival: true,
        plannedDeparture: true,
        actualDeparture: true,
        delayMinutes: true,
        trip: {
          select: {
            id: true,
            tripNumber: true,
            equipmentAssignments: {
              orderBy: { assignedAt: 'desc' },
              take: 1,
              select: {
                trailer: { select: { trailerBarcode: true } },
              },
            },
          },
        },
      },
      orderBy: { plannedArrival: 'desc' },
    });

    return stops.flatMap((stop) => {
      const trailerBarcode =
        stop.trip.equipmentAssignments[0]?.trailer?.trailerBarcode ?? null;
      return [
        ...(this.dateIsInRange(stop.actualArrival, filters)
          ? [{
              id: `${stop.id}:inbound`,
              direction: 'INBOUND' as const,
              tripId: stop.trip.id,
              tripNumber: stop.trip.tripNumber,
              trailerBarcode,
              plannedAt: stop.plannedArrival,
              actualAt: stop.actualArrival!,
              delayMinutes: this.delayMinutes(
                stop.plannedArrival,
                stop.actualArrival!,
              ),
            }]
          : []),
        ...(this.dateIsInRange(stop.actualDeparture, filters)
          ? [{
              id: `${stop.id}:outbound`,
              direction: 'OUTBOUND' as const,
              tripId: stop.trip.id,
              tripNumber: stop.trip.tripNumber,
              trailerBarcode,
              plannedAt: stop.plannedDeparture,
              actualAt: stop.actualDeparture!,
              delayMinutes: this.delayMinutes(
                stop.plannedDeparture,
                stop.actualDeparture!,
              ),
            }]
          : []),
      ];
    }).sort((left, right) => right.actualAt.getTime() - left.actualAt.getTime());
  }

  async getTerminal(terminalId: number) {
    const terminal = await this.prisma.terminal.findUnique({
      where: { id: terminalId },
      include: { snapshot: true },
    });

    if (!terminal) {
      throw new NotFoundException('Terminal not found');
    }

    return terminal;
  }

  async getHistory(terminalId: number) {
    await this.getTerminal(terminalId);

    return this.prisma.terminalEvent.findMany({
      where: { terminalId },
      orderBy: { createdAt: 'asc' },
    });
  }

  async getInventory(terminalId: number) {
    const [terminal, packages, containers, trailers] = await Promise.all([
      this.getTerminal(terminalId),
      this.prisma.packageSnapshot.findMany({
        where: { currentTerminalId: terminalId },
        orderBy: { trackingNumber: 'asc' },
      }),
      this.prisma.containerSnapshot.findMany({
        where: { currentTerminalId: terminalId },
        orderBy: { containerBarcode: 'asc' },
      }),
      this.prisma.trailerSnapshot.findMany({
        where: { currentTerminalId: terminalId },
        orderBy: { trailerBarcode: 'asc' },
      }),
    ]);

    return {
      terminalId,
      terminalCode: terminal.terminalCode,
      snapshot: terminal.snapshot,
      packages,
      containers,
      trailers,
    };
  }

  async getWarehouse(terminalId: number) {
    const inventory = await this.getInventory(terminalId);

    return {
      terminalId,
      terminalCode: inventory.terminalCode,
      packageCount: inventory.snapshot?.packageCount ?? 0,
      containerCount: inventory.snapshot?.containerCount ?? 0,
      packages: inventory.packages,
      containers: inventory.containers,
    };
  }

  async getYard(terminalId: number) {
    const inventory = await this.getInventory(terminalId);

    return {
      terminalId,
      terminalCode: inventory.terminalCode,
      trailerCount: inventory.snapshot?.trailerCount ?? 0,
      truckCount: inventory.snapshot?.truckCount ?? 0,
      trailers: inventory.trailers,
    };
  }

  async getOperations(terminalId: number) {
    const terminal = await this.getTerminal(terminalId);
    const recentEvents = await this.prisma.terminalEvent.findMany({
      where: { terminalId },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });

    return {
      terminalId,
      terminalCode: terminal.terminalCode,
      status: terminal.snapshot?.currentStatus,
      activeTripCount: terminal.snapshot?.activeTripCount ?? 0,
      employeeCount: terminal.snapshot?.employeeCount ?? 0,
      lastActivityAt: terminal.snapshot?.lastActivityAt ?? null,
      recentEvents,
    };
  }

  async receiveAsset(
    terminalId: number,
    dto: ReceiveTerminalAssetDto,
    requestId?: string,
  ) {
    const correlationId = requestId ?? randomUUID();

    return this.prisma.$transaction(async (tx) => {
      const terminal = await this.getTerminalWithSnapshot(tx, terminalId);
      this.assertTerminalCanOperate(terminal.snapshot.currentStatus);

      const movement = await this.resolveMovement(
        tx,
        dto.assetType,
        dto.assetIdentifier,
      );

      this.assertAssetCanBeReceived(movement, terminalId);
      await this.moveAssets(tx, movement, terminalId);

      const event = await tx.terminalEvent.create({
        data: {
          terminalId,
          eventType: this.receivedEventType(dto.assetType),
          employeeId: dto.employeeId,
          correlationId,
          payload: this.movementPayload(dto, movement),
        },
      });

      const snapshot = await this.incrementSnapshot(
        tx,
        terminalId,
        movement,
        event.createdAt,
      );

      return {
        success: true,
        terminalId,
        assetType: dto.assetType,
        assetIdentifier: dto.assetIdentifier,
        movedInventory: this.movementCounts(movement),
        snapshot,
        event,
      };
    });
  }

  async transferAsset(
    sourceTerminalId: number,
    dto: TransferTerminalAssetDto,
    requestId?: string,
  ) {
    if (sourceTerminalId === dto.destinationTerminalId) {
      throw new BadRequestException(
        'Source and destination terminals must be different',
      );
    }

    const correlationId = requestId ?? randomUUID();

    return this.prisma.$transaction(async (tx) => {
      const [source, destination] = await Promise.all([
        this.getTerminalWithSnapshot(tx, sourceTerminalId),
        this.getTerminalWithSnapshot(tx, dto.destinationTerminalId),
      ]);

      this.assertTerminalCanOperate(source.snapshot.currentStatus);
      this.assertTerminalCanOperate(destination.snapshot.currentStatus);

      const movement = await this.resolveMovement(
        tx,
        dto.assetType,
        dto.assetIdentifier,
      );

      this.assertAssetCanTransfer(movement, sourceTerminalId);
      this.assertSnapshotCanDecrement(source.snapshot, movement);

      await this.moveAssets(tx, movement, dto.destinationTerminalId);

      const sourceEvent = await tx.terminalEvent.create({
        data: {
          terminalId: sourceTerminalId,
          eventType: this.transferredEventType(dto.assetType),
          employeeId: dto.employeeId,
          correlationId,
          payload: {
            ...this.movementPayload(dto, movement),
            destinationTerminalId: dto.destinationTerminalId,
          },
        },
      });

      const destinationEvent = await tx.terminalEvent.create({
        data: {
          terminalId: dto.destinationTerminalId,
          eventType: this.receivedEventType(dto.assetType),
          employeeId: dto.employeeId,
          correlationId,
          payload: {
            ...this.movementPayload(dto, movement),
            sourceTerminalId,
          },
        },
      });

      const sourceSnapshot = await this.decrementSnapshot(
        tx,
        sourceTerminalId,
        movement,
        sourceEvent.createdAt,
      );
      const destinationSnapshot = await this.incrementSnapshot(
        tx,
        dto.destinationTerminalId,
        movement,
        destinationEvent.createdAt,
      );

      return {
        success: true,
        sourceTerminalId,
        destinationTerminalId: dto.destinationTerminalId,
        assetType: dto.assetType,
        assetIdentifier: dto.assetIdentifier,
        movedInventory: this.movementCounts(movement),
        sourceSnapshot,
        destinationSnapshot,
        events: [sourceEvent, destinationEvent],
      };
    });
  }

  private async getTerminalWithSnapshot(
    tx: TransactionClient,
    terminalId: number,
  ) {
    const terminal = await tx.terminal.findUnique({
      where: { id: terminalId },
      include: { snapshot: true },
    });

    if (!terminal?.snapshot) {
      throw new NotFoundException('Terminal not found');
    }

    return {
      ...terminal,
      snapshot: terminal.snapshot,
    };
  }

  private async resolveMovement(
    tx: TransactionClient,
    assetType: TerminalAssetType,
    assetIdentifier: string,
  ): Promise<AssetMovement> {
    if (assetType === TerminalAssetType.PACKAGE) {
      const packageSnapshot = await tx.packageSnapshot.findUnique({
        where: { trackingNumber: assetIdentifier },
      });

      if (!packageSnapshot) {
        throw new NotFoundException('Package not found');
      }

      if (
        packageSnapshot.currentContainerId ||
        packageSnapshot.currentTrailerId
      ) {
        throw new BadRequestException(
          'Loaded packages must move with their container or trailer',
        );
      }

      return {
        rootId: packageSnapshot.id,
        packages: [packageSnapshot],
        containers: [],
        trailers: [],
      };
    }

    if (assetType === TerminalAssetType.CONTAINER) {
      const container = await tx.containerSnapshot.findUnique({
        where: { containerBarcode: assetIdentifier },
      });

      if (!container) {
        throw new NotFoundException('Container not found');
      }

      if (container.currentTrailerId) {
        throw new BadRequestException(
          'Loaded containers must move with their trailer',
        );
      }

      const packages = await tx.packageSnapshot.findMany({
        where: { currentContainerId: container.id },
      });

      return {
        rootId: container.id,
        packages,
        containers: [container],
        trailers: [],
      };
    }

    const trailer = await tx.trailerSnapshot.findUnique({
      where: { trailerBarcode: assetIdentifier },
    });

    if (!trailer) {
      throw new NotFoundException('Trailer not found');
    }

    const containers = await tx.containerSnapshot.findMany({
      where: { currentTrailerId: trailer.id },
    });
    const containerIds = containers.map((container) => container.id);
    const packages = await tx.packageSnapshot.findMany({
      where: {
        OR: [
          { currentTrailerId: trailer.id },
          ...(containerIds.length
            ? [{ currentContainerId: { in: containerIds } }]
            : []),
        ],
      },
    });

    return {
      rootId: trailer.id,
      packages,
      containers,
      trailers: [trailer],
    };
  }

  private assertAssetCanBeReceived(
    movement: AssetMovement,
    terminalId: number,
  ) {
    const locations = this.assetLocations(movement);

    if (locations.some((location) => location === terminalId)) {
      throw new ConflictException('Asset is already present at this terminal');
    }

    if (locations.some((location) => location !== null)) {
      throw new ConflictException(
        'Asset belongs to another terminal and must be transferred',
      );
    }
  }

  private assertAssetCanTransfer(
    movement: AssetMovement,
    sourceTerminalId: number,
  ) {
    if (
      this.assetLocations(movement).some(
        (location) => location !== sourceTerminalId,
      )
    ) {
      throw new BadRequestException(
        'Source terminal does not own the complete asset inventory',
      );
    }
  }

  private assertSnapshotCanDecrement(
    snapshot: {
      packageCount: number;
      containerCount: number;
      trailerCount: number;
    },
    movement: AssetMovement,
  ) {
    const counts = this.movementCounts(movement);

    if (
      snapshot.packageCount < counts.packageCount ||
      snapshot.containerCount < counts.containerCount ||
      snapshot.trailerCount < counts.trailerCount
    ) {
      throw new ConflictException(
        'Terminal snapshot does not match current asset ownership',
      );
    }
  }

  private async moveAssets(
    tx: TransactionClient,
    movement: AssetMovement,
    terminalId: number,
  ) {
    const packageIds = movement.packages.map((asset) => asset.id);
    const containerIds = movement.containers.map((asset) => asset.id);
    const trailerIds = movement.trailers.map((asset) => asset.id);

    if (packageIds.length) {
      await tx.packageSnapshot.updateMany({
        where: { id: { in: packageIds } },
        data: { currentTerminalId: terminalId },
      });
    }

    if (containerIds.length) {
      await tx.containerSnapshot.updateMany({
        where: { id: { in: containerIds } },
        data: { currentTerminalId: terminalId },
      });
    }

    if (trailerIds.length) {
      await tx.trailerSnapshot.updateMany({
        where: { id: { in: trailerIds } },
        data: { currentTerminalId: terminalId },
      });
    }
  }

  private incrementSnapshot(
    tx: TransactionClient,
    terminalId: number,
    movement: AssetMovement,
    lastActivityAt: Date,
  ) {
    const counts = this.movementCounts(movement);

    return tx.terminalSnapshot.update({
      where: { terminalId },
      data: {
        packageCount: { increment: counts.packageCount },
        containerCount: { increment: counts.containerCount },
        trailerCount: { increment: counts.trailerCount },
        lastActivityAt,
      },
    });
  }

  private decrementSnapshot(
    tx: TransactionClient,
    terminalId: number,
    movement: AssetMovement,
    lastActivityAt: Date,
  ) {
    const counts = this.movementCounts(movement);

    return tx.terminalSnapshot.update({
      where: { terminalId },
      data: {
        packageCount: { decrement: counts.packageCount },
        containerCount: { decrement: counts.containerCount },
        trailerCount: { decrement: counts.trailerCount },
        lastActivityAt,
      },
    });
  }

  private movementCounts(movement: AssetMovement) {
    return {
      packageCount: movement.packages.length,
      containerCount: movement.containers.length,
      trailerCount: movement.trailers.length,
    };
  }

  private movementPayload(
    dto: ReceiveTerminalAssetDto,
    movement: AssetMovement,
  ) {
    return {
      assetType: dto.assetType,
      assetIdentifier: dto.assetIdentifier,
      rootId: movement.rootId,
      ...this.movementCounts(movement),
    };
  }

  private assetLocations(movement: AssetMovement) {
    return [
      ...movement.packages,
      ...movement.containers,
      ...movement.trailers,
    ].map((asset) => asset.currentTerminalId);
  }

  private receivedEventType(assetType: TerminalAssetType) {
    const eventTypes: Record<TerminalAssetType, TerminalEventType> = {
      PACKAGE: TerminalEventType.PACKAGE_RECEIVED,
      CONTAINER: TerminalEventType.CONTAINER_RECEIVED,
      TRAILER: TerminalEventType.TRAILER_ARRIVED,
    };

    return eventTypes[assetType];
  }

  private transferredEventType(assetType: TerminalAssetType) {
    const eventTypes: Record<TerminalAssetType, TerminalEventType> = {
      PACKAGE: TerminalEventType.PACKAGE_TRANSFERRED,
      CONTAINER: TerminalEventType.CONTAINER_TRANSFERRED,
      TRAILER: TerminalEventType.TRAILER_DEPARTED,
    };

    return eventTypes[assetType];
  }

  private assertTerminalCanOperate(status: TerminalStatus) {
    if (status === TerminalStatus.CLOSED) {
      throw new BadRequestException('Closed terminals cannot process assets');
    }
  }

  private activityDateRange(
    filters: Pick<TerminalPerformanceQueryDto, 'fromDate' | 'toDate'>,
  ): Prisma.DateTimeFilter | undefined {
    if (filters.fromDate && filters.toDate && filters.fromDate > filters.toDate) {
      throw new BadRequestException('fromDate must be on or before toDate');
    }
    if (!filters.fromDate && !filters.toDate) return undefined;
    const range: Prisma.DateTimeFilter = {};
    if (filters.fromDate) {
      range.gte = new Date(`${filters.fromDate}T00:00:00.000Z`);
    }
    if (filters.toDate) {
      const exclusiveEnd = new Date(`${filters.toDate}T00:00:00.000Z`);
      exclusiveEnd.setUTCDate(exclusiveEnd.getUTCDate() + 1);
      range.lt = exclusiveEnd;
    }
    return range;
  }

  private dateIsInRange(
    value: Date | null,
    filters: Pick<TerminalPerformanceQueryDto, 'fromDate' | 'toDate'>,
  ) {
    if (!value) return false;
    const range = this.activityDateRange(filters);
    if (!range) return true;
    const lower = range.gte as Date | undefined;
    const upper = range.lt as Date | undefined;
    return (!lower || value >= lower) && (!upper || value < upper);
  }

  private delayMinutes(planned: Date, actual: Date) {
    return Math.max(
      0,
      Math.round((actual.getTime() - planned.getTime()) / 60_000),
    );
  }

  private normalizeCode(value: string) {
    return value.trim().toUpperCase();
  }

  private normalizeText(value: string) {
    return value.trim().replace(/\s+/g, ' ');
  }

  private cityKey(city: string) {
    return this.normalizeText(city).toLocaleLowerCase('en-CA');
  }

  private async nameForCityUpdate(
    tx: TransactionClient,
    currentCity: string,
    currentName: string,
    nextCity: string,
  ) {
    if (this.cityKey(currentCity) !== this.cityKey(nextCity)) {
      return this.nextTerminalName(tx, nextCity);
    }

    // Preserve the existing sequence when only city spacing or casing changes.
    const currentNumber = currentName.match(/-(\d{3})$/)?.[1];
    return currentNumber
      ? `${nextCity}-${currentNumber}`
      : this.nextTerminalName(tx, nextCity);
  }

  /** Allocates the next three-digit display number for a normalized city. */
  private async nextTerminalName(tx: TransactionClient, city: string) {
    const cityKey = this.cityKey(city);
    const sequence = await tx.terminalNameSequence.upsert({
      where: { cityKey },
      create: { cityKey, lastNumber: 0 },
      update: { lastNumber: { increment: 1 } },
    });

    if (sequence.lastNumber > 999) {
      throw new ConflictException(`Terminal name sequence exhausted for ${city}`);
    }

    return `${city}-${sequence.lastNumber.toString().padStart(3, '0')}`;
  }

  private toJson(value: object): Prisma.InputJsonValue {
    return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
  }
}
