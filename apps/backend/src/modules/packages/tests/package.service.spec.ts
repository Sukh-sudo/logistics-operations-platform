import {
  PackageEventType,
  PackageStatus,
  PackageType,
  ProjectionStatus,
  TerminalStatus,
} from '@prisma/client';
import { PackageService } from '../services/package.service';

describe('PackageService', () => {
  const createdAt = new Date('2026-07-24T12:00:00.000Z');
  const tx = {
    packageSnapshot: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    package: { create: jest.fn() },
    packageEvent: { create: jest.fn() },
    packageProjectionOutbox: { create: jest.fn() },
    terminal: { findUnique: jest.fn() },
    terminalEvent: { create: jest.fn() },
    terminalSnapshot: { update: jest.fn() },
  };
  const prisma = {
    $transaction: jest.fn((operation) => operation(tx)),
    packageProjectionOutbox: {
      findMany: jest.fn(),
      updateMany: jest.fn(),
      update: jest.fn(),
    },
    packageEvent: { findUnique: jest.fn() },
  };
  const kafka = { publish: jest.fn() };
  const validator = { validateTransition: jest.fn() };
  const shipments = { synchronizePackageProgress: jest.fn() };
  let service: PackageService;

  beforeEach(() => {
    jest.clearAllMocks();
    kafka.publish.mockResolvedValue(undefined);
    shipments.synchronizePackageProgress.mockResolvedValue(null);
    service = new PackageService(
      prisma as never,
      kafka as never,
      validator as never,
      shipments as never,
    );
  });

  it('creates aggregate identity, event, outbox, and snapshots atomically', async () => {
    tx.packageSnapshot.findUnique.mockResolvedValue(null);
    tx.terminal.findUnique.mockResolvedValue({
      id: 7,
      snapshot: { currentStatus: TerminalStatus.OPERATIONAL },
    });
    tx.package.create.mockResolvedValue({
      id: 'package-1',
      trackingNumber: 'CON1234567',
      packageType: PackageType.CONVEYABLE,
    });
    tx.packageSnapshot.create.mockResolvedValue({
      id: 'package-1',
      trackingNumber: 'CON1234567',
      packageType: PackageType.CONVEYABLE,
      currentStatus: PackageStatus.RECEIVED,
      currentTerminalId: 7,
    });
    tx.packageEvent.create.mockResolvedValue({
      id: 'package-event-1',
      createdAt,
    });
    tx.terminalEvent.create.mockResolvedValue({ createdAt });
    tx.packageSnapshot.update.mockResolvedValue({
      id: 'package-1',
      currentStatus: PackageStatus.RECEIVED,
      currentTerminalId: 7,
    });
    prisma.packageProjectionOutbox.updateMany.mockResolvedValue({ count: 0 });

    const result = await service.createPackageEvent(
      {
        trackingNumber: 'CON1234567',
        eventType: PackageEventType.PACKAGE_RECEIVED,
        terminalId: 7,
      },
      'correlation-1',
    );

    expect(tx.package.create).toHaveBeenCalledWith({
      data: {
        trackingNumber: 'CON1234567',
        packageType: PackageType.CONVEYABLE,
      },
    });
    expect(tx.packageEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        packageId: 'package-1',
        correlationId: 'correlation-1',
      }),
    });
    expect(tx.packageProjectionOutbox.create).toHaveBeenCalledWith({
      data: { packageEventId: 'package-event-1' },
    });
    expect(tx.terminalSnapshot.update).toHaveBeenCalledWith({
      where: { terminalId: 7 },
      data: {
        packageCount: { increment: 1 },
        lastActivityAt: createdAt,
      },
    });
    expect(result.snapshot.currentStatus).toBe(PackageStatus.RECEIVED);
  });

  it('completes a durable shipment projection after claiming its outbox row', async () => {
    prisma.packageProjectionOutbox.updateMany.mockResolvedValue({ count: 1 });
    prisma.packageEvent.findUnique.mockResolvedValue({
      id: 'package-event-1',
      eventType: PackageEventType.PACKAGE_ARRIVED,
      terminalId: 8,
      correlationId: 'correlation-1',
      package: { trackingNumber: 'CON1234567' },
    });

    await service.processProjection('package-event-1');

    expect(shipments.synchronizePackageProgress).toHaveBeenCalledWith(
      'CON1234567',
      PackageEventType.PACKAGE_ARRIVED,
      8,
      'correlation-1',
      'package-event-1',
    );
    expect(prisma.packageProjectionOutbox.update).toHaveBeenCalledWith({
      where: { packageEventId: 'package-event-1' },
      data: {
        status: ProjectionStatus.COMPLETED,
        processedAt: expect.any(Date),
      },
    });
  });

  it('removes a departing package from terminal inventory', async () => {
    tx.packageSnapshot.findUnique.mockResolvedValue({
      id: 'package-1',
      trackingNumber: 'CON1234567',
      packageType: PackageType.CONVEYABLE,
      currentStatus: PackageStatus.IN_TRAILER,
      currentTerminalId: 7,
    });
    tx.packageEvent.create.mockResolvedValue({
      id: 'package-event-1',
      createdAt,
    });
    tx.terminalEvent.create.mockResolvedValue({ createdAt });
    tx.packageSnapshot.update.mockResolvedValue({
      id: 'package-1',
      currentStatus: PackageStatus.DEPARTED,
      currentTerminalId: null,
    });
    prisma.packageProjectionOutbox.updateMany.mockResolvedValue({ count: 0 });

    const result = await service.createPackageEvent(
      {
        trackingNumber: 'CON1234567',
        eventType: PackageEventType.PACKAGE_DEPARTED,
        terminalId: 7,
      },
      'correlation-1',
    );

    expect(tx.terminalSnapshot.update).toHaveBeenCalledWith({
      where: { terminalId: 7 },
      data: {
        packageCount: { decrement: 1 },
        lastActivityAt: createdAt,
      },
    });
    expect(result.snapshot.currentTerminalId).toBeNull();
  });

  it('records projection failures for a later retry', async () => {
    prisma.packageProjectionOutbox.updateMany.mockResolvedValue({ count: 1 });
    prisma.packageEvent.findUnique.mockResolvedValue({
      id: 'package-event-1',
      eventType: PackageEventType.PACKAGE_ARRIVED,
      terminalId: 8,
      correlationId: 'correlation-1',
      package: { trackingNumber: 'CON1234567' },
    });
    shipments.synchronizePackageProgress.mockRejectedValue(
      new Error('projection unavailable'),
    );

    await service.processProjection('package-event-1');

    expect(prisma.packageProjectionOutbox.update).toHaveBeenLastCalledWith({
      where: { packageEventId: 'package-event-1' },
      data: {
        status: ProjectionStatus.FAILED,
        lastError: 'projection unavailable',
      },
    });
  });
});
