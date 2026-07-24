import {
  ContainerEventType,
  PackageEventType,
  PackageStatus,
  PackageType,
  TrailerEventType,
} from '@prisma/client';
import { SnapshotRebuildService } from '../services/snapshot-rebuild.service';

describe('SnapshotRebuildService', () => {
  it('deletes disposable snapshots and recreates them from events and history', async () => {
    const tx = {
      package: {
        findMany: jest.fn().mockResolvedValue([{
          id: 'package-1',
          trackingNumber: 'CON1234567',
          packageType: PackageType.CONVEYABLE,
          events: [{
            eventType: PackageEventType.PACKAGE_DEPARTED,
            terminalId: 1,
            metadata: { currentTerminalId: null },
          }],
        }]),
      },
      container: {
        findMany: jest.fn().mockResolvedValue([{
          id: 'container-1',
          containerBarcode: 'CON7654321',
          packageType: PackageType.CONVEYABLE,
          events: [{
            eventType: ContainerEventType.CONTAINER_CREATED,
            metadata: { terminalId: 1 },
          }],
        }]),
      },
      trailer: {
        findMany: jest.fn().mockResolvedValue([{
          id: 'trailer-1',
          trailerBarcode: 'TRLR123456',
          events: [{
            eventType: TrailerEventType.TRAILER_CREATED,
            metadata: { terminalId: 1 },
          }],
        }]),
      },
      packageSnapshot: { deleteMany: jest.fn(), create: jest.fn() },
      containerSnapshot: { deleteMany: jest.fn(), create: jest.fn() },
      trailerSnapshot: { deleteMany: jest.fn(), create: jest.fn() },
      packageContainerHistory: {
        findFirst: jest.fn().mockResolvedValue({ containerId: 'container-1' }),
        count: jest.fn().mockResolvedValue(1),
      },
      packageTrailerHistory: {
        findFirst: jest.fn().mockResolvedValue(null),
        count: jest.fn().mockResolvedValue(0),
      },
      containerTrailerHistory: {
        findFirst: jest.fn().mockResolvedValue({ trailerId: 'trailer-1' }),
        count: jest.fn().mockResolvedValue(1),
      },
    };
    const prisma = {
      $transaction: jest.fn((operation) => operation(tx)),
    };
    const service = new SnapshotRebuildService(prisma as never);

    const result = await service.rebuildAll();

    expect(tx.packageSnapshot.deleteMany).toHaveBeenCalledTimes(1);
    expect(tx.packageSnapshot.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        id: 'package-1',
        currentStatus: PackageStatus.DEPARTED,
        currentTerminalId: null,
        currentContainerId: 'container-1',
      }),
    });
    expect(tx.containerSnapshot.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        id: 'container-1',
        currentTerminalId: 1,
        currentTrailerId: 'trailer-1',
        packageCount: 1,
      }),
    });
    expect(tx.trailerSnapshot.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        id: 'trailer-1',
        currentTerminalId: 1,
        containerCount: 1,
      }),
    });
    expect(result).toEqual({ packages: 1, containers: 1, trailers: 1 });
  });
});
