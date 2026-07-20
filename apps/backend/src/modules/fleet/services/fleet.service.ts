import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { DriverStatus, EquipmentAssignmentStatus, FleetEventType, Prisma, TrailerStatus, TripStatus, TruckPurpose, TruckStatus } from '@prisma/client';
import { randomUUID } from 'crypto';
import { PrismaService } from '../../../infrastructure/prisma/prisma.service';
import { CreateDriverDto } from '../dto/create-driver.dto';
import { CreateTruckDto } from '../dto/create-truck.dto';
import { AssignEquipmentDto } from '../dto/assign-equipment.dto';

type TransactionClient = Prisma.TransactionClient;

@Injectable()
export class FleetService {
  constructor(private readonly prisma: PrismaService) {}

  async createTruck(dto: CreateTruckDto, requestId?: string) {
    const correlationId = requestId ?? randomUUID();
    const licensePlate = this.normalize(dto.licensePlate);

    // A truck is created atomically with its immutable business event and read snapshot.
    return this.prisma.$transaction(async (tx) => {
      const terminal = await this.getUnitNumberTerminal(tx, dto.terminalId);
      const unitNumber = await this.allocateUnitNumber(tx, dto.purpose, terminal);
      await this.ensureTruckIdentifiersAvailable(tx, unitNumber, licensePlate);

      const truck = await tx.truck.create({
        data: {
          unitNumber,
          purpose: dto.purpose,
          licensePlate,
          terminalId: dto.terminalId,
          year: dto.year,
          make: dto.make?.trim(),
          model: dto.model?.trim(),
          status: TruckStatus.AVAILABLE,
        },
      });

      const event = await tx.fleetEvent.create({
        data: {
          truckId: truck.id,
          eventType: FleetEventType.TRUCK_CREATED,
          correlationId,
          payload: {
            unitNumber,
            purpose: dto.purpose,
            licensePlate,
            terminalId: truck.terminalId,
            terminalCode: terminal.terminalCode,
            status: truck.status,
          },
        },
      });

      const snapshot = await tx.truckSnapshot.create({
        data: {
          truckId: truck.id,
          currentStatus: truck.status,
          currentTerminalId: truck.terminalId,
          lastActivityAt: event.createdAt,
        },
      });

      return { truck, snapshot, event };
    });
  }

  async createDriver(dto: CreateDriverDto, requestId?: string) {
    const correlationId = requestId ?? randomUUID();
    const employeeId = this.normalize(dto.employeeId);
    const licenseNumber = this.normalize(dto.licenseNumber);

    // Driver creation follows the same event + snapshot pattern as other business modules.
    return this.prisma.$transaction(async (tx) => {
      await this.ensureTerminalExists(tx, dto.terminalId);
      await this.ensureDriverIdentifiersAvailable(tx, employeeId, licenseNumber);

      const driver = await tx.driver.create({
        data: {
          employeeId,
          licenseNumber,
          licenseClass: dto.licenseClass.trim(),
          terminalId: dto.terminalId,
          status: DriverStatus.AVAILABLE,
        },
      });

      const event = await tx.fleetEvent.create({
        data: {
          driverId: driver.id,
          eventType: FleetEventType.DRIVER_CREATED,
          correlationId,
          payload: {
            employeeId,
            licenseNumber,
            licenseClass: driver.licenseClass,
            terminalId: driver.terminalId,
            status: driver.status,
          },
        },
      });

      const snapshot = await tx.driverSnapshot.create({
        data: {
          driverId: driver.id,
          currentStatus: driver.status,
          currentTerminalId: driver.terminalId,
          lastActivityAt: event.createdAt,
        },
      });

      return { driver, snapshot, event };
    });
  }

  getTrucks() {
    // Operational reads use the snapshot relation instead of rebuilding state from events.
    return this.prisma.truck.findMany({
      include: { terminal: true, snapshot: true },
      orderBy: { unitNumber: 'asc' },
    });
  }

  async getTruck(id: string) {
    const truck = await this.prisma.truck.findUnique({
      where: { id },
      include: { terminal: true, snapshot: true },
    });
    if (!truck) throw new NotFoundException('Truck not found');
    return truck;
  }

  getDrivers() {
    // Operational reads use the snapshot relation instead of rebuilding state from events.
    return this.prisma.driver.findMany({
      include: { terminal: true, snapshot: true },
      orderBy: { employeeId: 'asc' },
    });
  }

  async getDriver(id: string) {
    const driver = await this.prisma.driver.findUnique({
      where: { id },
      include: { terminal: true, snapshot: true },
    });
    if (!driver) throw new NotFoundException('Driver not found');
    return driver;
  }

  getAvailability(terminalId?: number) {
    // Availability reads come directly from snapshots; events remain historical truth.
    const snapshotWhere = {
      currentTerminalId: terminalId,
      assignedTripId: null,
    };
    return Promise.all([
      this.prisma.truckSnapshot.findMany({
        where: { ...snapshotWhere, currentStatus: TruckStatus.AVAILABLE },
        include: { truck: { include: { terminal: true } } },
        orderBy: { truck: { unitNumber: 'asc' } },
      }),
      this.prisma.driverSnapshot.findMany({
        where: { ...snapshotWhere, currentStatus: DriverStatus.AVAILABLE },
        include: { driver: { include: { terminal: true } } },
        orderBy: { driver: { employeeId: 'asc' } },
      }),
      this.prisma.trailerSnapshot.findMany({
        where: {
          currentStatus: { in: [TrailerStatus.OPEN, TrailerStatus.CLOSED, TrailerStatus.ARRIVED] },
          currentTerminalId: terminalId,
          equipmentAssignments: { none: { status: EquipmentAssignmentStatus.ACTIVE } },
        },
        orderBy: { trailerBarcode: 'asc' },
      }),
    ]).then(([truckSnapshots, driverSnapshots, trailers]) => ({
      trucks: truckSnapshots.map(({ truck, ...snapshot }) => ({ ...truck, snapshot })),
      drivers: driverSnapshots.map(({ driver, ...snapshot }) => ({ ...driver, snapshot })),
      trailers,
    }));
  }

  async assignEquipment(dto: AssignEquipmentDto, requestId?: string) {
    const correlationId = requestId ?? randomUUID();
    return this.prisma.$transaction(async (tx) => {
      const [trip, truck, driver, trailer, trailerAssignment] = await Promise.all([
        tx.trip.findUnique({ where: { id: dto.tripId } }),
        tx.truck.findUnique({ where: { id: dto.truckId }, include: { snapshot: true } }),
        tx.driver.findUnique({ where: { id: dto.driverId }, include: { snapshot: true } }),
        tx.trailerSnapshot.findUnique({ where: { id: dto.trailerId } }),
        tx.equipmentAssignment.findFirst({ where: { trailerId: dto.trailerId, status: EquipmentAssignmentStatus.ACTIVE } }),
      ]);
      if (!trip) throw new NotFoundException('Trip not found');
      if (!truck) throw new NotFoundException('Truck not found');
      if (!driver) throw new NotFoundException('Driver not found');
      if (!trailer) throw new NotFoundException('Trailer not found');
      if (trip.status !== TripStatus.CREATED) throw new ConflictException('Equipment can only be assigned to a created trip');
      if (trip.equipmentAssignmentId) throw new ConflictException('Trip already has active equipment');
      if (truck.status !== TruckStatus.AVAILABLE || truck.snapshot?.assignedTripId) throw new ConflictException('Truck is not available');
      if (driver.status !== DriverStatus.AVAILABLE || driver.snapshot?.assignedTripId) throw new ConflictException('Driver is not available');
      if (trailer.currentStatus === TrailerStatus.IN_TRANSIT || trailerAssignment) throw new ConflictException('Trailer is not available');

      // The assignment row preserves allocation history; snapshots serve current-state reads.
      const assignment = await tx.equipmentAssignment.create({
        data: { tripId: trip.id, truckId: truck.id, driverId: driver.id, trailerId: trailer.id },
      });
      await tx.trip.update({ where: { id: trip.id }, data: { equipmentAssignmentId: assignment.id } });
      await tx.truck.update({ where: { id: truck.id }, data: { status: TruckStatus.ASSIGNED } });
      await tx.driver.update({ where: { id: driver.id }, data: { status: DriverStatus.ASSIGNED } });
      const truckEvent = await tx.fleetEvent.create({ data: { truckId: truck.id, eventType: FleetEventType.TRUCK_ASSIGNED, correlationId, payload: { tripId: trip.id, trailerId: trailer.id, assignmentId: assignment.id } } });
      const driverEvent = await tx.fleetEvent.create({ data: { driverId: driver.id, eventType: FleetEventType.DRIVER_ASSIGNED, correlationId, payload: { tripId: trip.id, trailerId: trailer.id, assignmentId: assignment.id } } });
      const truckSnapshot = await tx.truckSnapshot.update({ where: { truckId: truck.id }, data: { currentStatus: TruckStatus.ASSIGNED, assignedTripId: trip.id, lastActivityAt: truckEvent.createdAt } });
      const driverSnapshot = await tx.driverSnapshot.update({ where: { driverId: driver.id }, data: { currentStatus: DriverStatus.ASSIGNED, assignedTripId: trip.id, lastActivityAt: driverEvent.createdAt } });
      return { assignment, events: [truckEvent, driverEvent], truckSnapshot, driverSnapshot };
    });
  }

  async releaseEquipment(id: string, requestId?: string) {
    const correlationId = requestId ?? randomUUID();
    return this.prisma.$transaction(async (tx) => {
      const current = await tx.equipmentAssignment.findUnique({ where: { id }, include: { trip: true } });
      if (!current) throw new NotFoundException('Equipment assignment not found');
      if (current.status !== EquipmentAssignmentStatus.ACTIVE) throw new ConflictException('Equipment assignment is already released');
      if (current.trip.status === TripStatus.IN_PROGRESS) throw new ConflictException('Equipment cannot be released while the trip is in progress');
      const assignment = await tx.equipmentAssignment.update({ where: { id }, data: { status: EquipmentAssignmentStatus.RELEASED, releasedAt: new Date() } });
      await tx.trip.update({ where: { id: current.tripId }, data: { equipmentAssignmentId: null } });
      await tx.truck.update({ where: { id: current.truckId }, data: { status: TruckStatus.AVAILABLE } });
      await tx.driver.update({ where: { id: current.driverId }, data: { status: DriverStatus.AVAILABLE } });
      const truckEvent = await tx.fleetEvent.create({ data: { truckId: current.truckId, eventType: FleetEventType.EQUIPMENT_RELEASED, correlationId, payload: { tripId: current.tripId, assignmentId: id } } });
      const driverEvent = await tx.fleetEvent.create({ data: { driverId: current.driverId, eventType: FleetEventType.EQUIPMENT_RELEASED, correlationId, payload: { tripId: current.tripId, assignmentId: id } } });
      const truckSnapshot = await tx.truckSnapshot.update({ where: { truckId: current.truckId }, data: { currentStatus: TruckStatus.AVAILABLE, assignedTripId: null, lastActivityAt: truckEvent.createdAt } });
      const driverSnapshot = await tx.driverSnapshot.update({ where: { driverId: current.driverId }, data: { currentStatus: DriverStatus.AVAILABLE, assignedTripId: null, lastActivityAt: driverEvent.createdAt } });
      return { assignment, events: [truckEvent, driverEvent], truckSnapshot, driverSnapshot };
    });
  }

  getAssignments() {
    return this.prisma.equipmentAssignment.findMany({ include: { trip: true, truck: true, driver: true, trailer: true }, orderBy: { assignedAt: 'desc' } });
  }

  private async ensureTerminalExists(tx: TransactionClient, terminalId?: number) {
    if (terminalId === undefined) return;
    const terminal = await tx.terminal.findUnique({ where: { id: terminalId }, select: { id: true } });
    if (!terminal) throw new NotFoundException('Terminal not found');
  }

  private async getUnitNumberTerminal(tx: TransactionClient, terminalId: number) {
    const terminal = await tx.terminal.findUnique({
      where: { id: terminalId },
      select: { id: true, terminalCode: true },
    });
    if (!terminal) throw new NotFoundException('Terminal not found');

    const terminalCode = this.normalize(terminal.terminalCode);
    if (!/^[A-Z]{3}$/.test(terminalCode)) {
      throw new BadRequestException(
        'Owning terminal code must contain exactly three letters for fleet unit numbering',
      );
    }

    return { ...terminal, terminalCode };
  }

  private async allocateUnitNumber(
    tx: TransactionClient,
    purpose: TruckPurpose,
    terminal: { id: number; terminalCode: string },
  ) {
    // The database counter is incremented inside the truck transaction, so a
    // failed event or snapshot write also rolls the allocated number back.
    const sequence = await tx.fleetUnitSequence.upsert({
      where: {
        terminalId_purpose: { terminalId: terminal.id, purpose },
      },
      create: { terminalId: terminal.id, purpose, lastNumber: 1 },
      update: { lastNumber: { increment: 1 } },
    });

    if (sequence.lastNumber > 99_999) {
      throw new ConflictException('Fleet unit number sequence is exhausted');
    }

    const purposePrefix = purpose === TruckPurpose.LAST_MILE ? 'LM' : 'MM';
    return `${purposePrefix}${terminal.terminalCode}${sequence.lastNumber.toString().padStart(5, '0')}`;
  }

  private async ensureTruckIdentifiersAvailable(
    tx: TransactionClient,
    unitNumber: string,
    licensePlate: string,
  ) {
    const existing = await tx.truck.findFirst({
      where: { OR: [{ unitNumber }, { licensePlate }] },
    });
    if (existing?.unitNumber === unitNumber) {
      throw new ConflictException('Truck unit number already exists');
    }
    if (existing?.licensePlate === licensePlate) {
      throw new ConflictException('Truck license plate already exists');
    }
  }

  private async ensureDriverIdentifiersAvailable(
    tx: TransactionClient,
    employeeId: string,
    licenseNumber: string,
  ) {
    const existing = await tx.driver.findFirst({
      where: { OR: [{ employeeId }, { licenseNumber }] },
    });
    if (existing?.employeeId === employeeId) {
      throw new ConflictException('Driver employee ID already exists');
    }
    if (existing?.licenseNumber === licenseNumber) {
      throw new ConflictException('Driver license number already exists');
    }
  }

  private normalize(value: string) {
    return value.trim().toUpperCase();
  }
}
