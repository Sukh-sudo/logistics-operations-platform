import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { DriverStatus, FleetEventType, Prisma, TruckStatus } from '@prisma/client';
import { randomUUID } from 'crypto';
import { PrismaService } from '../../../infrastructure/prisma/prisma.service';
import { CreateDriverDto } from '../dto/create-driver.dto';
import { CreateTruckDto } from '../dto/create-truck.dto';

type TransactionClient = Prisma.TransactionClient;

@Injectable()
export class FleetService {
  constructor(private readonly prisma: PrismaService) {}

  async createTruck(dto: CreateTruckDto, requestId?: string) {
    const correlationId = requestId ?? randomUUID();
    const unitNumber = this.normalize(dto.unitNumber);
    const licensePlate = this.normalize(dto.licensePlate);

    // A truck is created atomically with its immutable business event and read snapshot.
    return this.prisma.$transaction(async (tx) => {
      await this.ensureTerminalExists(tx, dto.terminalId);
      await this.ensureTruckIdentifiersAvailable(tx, unitNumber, licensePlate);

      const truck = await tx.truck.create({
        data: {
          unitNumber,
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
            licensePlate,
            terminalId: truck.terminalId,
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

  private async ensureTerminalExists(tx: TransactionClient, terminalId?: number) {
    if (terminalId === undefined) return;
    const terminal = await tx.terminal.findUnique({ where: { id: terminalId }, select: { id: true } });
    if (!terminal) throw new NotFoundException('Terminal not found');
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
