import {
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import {
  TerminalAssetType,
  TerminalEventType,
  TerminalStatus,
} from '@prisma/client';
import { TerminalService } from '../services/terminal.service';

describe('TerminalService', () => {
  const tx = {
    terminal: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    terminalNameSequence: {
      upsert: jest.fn(),
    },
    terminalEvent: {
      create: jest.fn(),
    },
    terminalSnapshot: {
      create: jest.fn(),
      update: jest.fn(),
    },
    packageSnapshot: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      updateMany: jest.fn(),
    },
    containerSnapshot: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      updateMany: jest.fn(),
    },
    trailerSnapshot: {
      findUnique: jest.fn(),
      updateMany: jest.fn(),
    },
  };

  const prisma = {
    $transaction: jest.fn((callback) => callback(tx)),
  };

  let service: TerminalService;

  beforeEach(() => {
    jest.clearAllMocks();
    tx.terminalNameSequence.upsert.mockResolvedValue({
      cityKey: 'calgary',
      lastNumber: 0,
    });
    service = new TerminalService(prisma as never);
  });

  it('creates a terminal event and snapshot in one transaction', async () => {
    const createdAt = new Date();
    tx.terminal.findUnique.mockResolvedValue(null);
    tx.terminal.create.mockResolvedValue({
      id: 1,
      terminalCode: 'YYC',
      name: 'Calgary-000',
      city: 'Calgary',
      province: 'Alberta',
      country: 'Canada',
      timezone: 'America/Edmonton',
    });
    tx.terminalEvent.create.mockResolvedValue({
      id: 'event-1',
      eventType: TerminalEventType.TERMINAL_CREATED,
      createdAt,
    });
    tx.terminalSnapshot.create.mockResolvedValue({
      terminalId: 1,
      currentStatus: TerminalStatus.ACTIVE,
    });

    const result = await service.createTerminal({
      terminalCode: ' yyc ',
      city: '  Calgary  ',
      province: 'Alberta',
      country: 'Canada',
      timezone: 'America/Edmonton',
    });

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(tx.terminalNameSequence.upsert).toHaveBeenCalledWith({
      where: { cityKey: 'calgary' },
      create: { cityKey: 'calgary', lastNumber: 0 },
      update: { lastNumber: { increment: 1 } },
    });
    expect(tx.terminal.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          terminalCode: 'YYC',
          name: 'Calgary-000',
          city: 'Calgary',
        }),
      }),
    );
    expect(tx.terminalEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          eventType: TerminalEventType.TERMINAL_CREATED,
          payload: expect.objectContaining({ name: 'Calgary-000' }),
        }),
      }),
    );
    expect(tx.terminalSnapshot.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        terminalId: 1,
        lastActivityAt: createdAt,
      }),
    });
    expect(result.snapshot.currentStatus).toBe(TerminalStatus.ACTIVE);
  });

  it('rejects duplicate terminal codes', async () => {
    tx.terminal.findUnique.mockResolvedValue({ id: 1 });

    await expect(
      service.createTerminal({
        terminalCode: 'YYC',
        city: 'Calgary',
        province: 'Alberta',
        country: 'Canada',
        timezone: 'America/Edmonton',
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('rejects a city after its three-digit sequence is exhausted', async () => {
    tx.terminal.findUnique.mockResolvedValue(null);
    tx.terminalNameSequence.upsert.mockResolvedValue({
      cityKey: 'calgary',
      lastNumber: 1000,
    });

    await expect(
      service.createTerminal({
        terminalCode: 'YYC',
        city: 'Calgary',
        province: 'Alberta',
        country: 'Canada',
        timezone: 'America/Edmonton',
      }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(tx.terminal.create).not.toHaveBeenCalled();
  });

  it('allocates a new generated name when a terminal changes cities', async () => {
    const createdAt = new Date();
    tx.terminal.findUnique.mockResolvedValue({
      id: 1,
      name: 'Calgary-000',
      city: 'Calgary',
      snapshot: { currentStatus: TerminalStatus.ACTIVE },
    });
    tx.terminalNameSequence.upsert.mockResolvedValue({
      cityKey: 'edmonton',
      lastNumber: 4,
    });
    tx.terminal.update.mockResolvedValue({
      id: 1,
      name: 'Edmonton-004',
      city: 'Edmonton',
    });
    tx.terminalEvent.create.mockResolvedValue({
      eventType: TerminalEventType.TERMINAL_UPDATED,
      createdAt,
    });
    tx.terminalSnapshot.update.mockResolvedValue({ terminalId: 1 });

    const result = await service.updateTerminal(1, { city: ' Edmonton ' });

    expect(tx.terminal.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: expect.objectContaining({ city: 'Edmonton', name: 'Edmonton-004' }),
    });
    expect(tx.terminalEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        eventType: TerminalEventType.TERMINAL_UPDATED,
        payload: { city: ' Edmonton ', name: 'Edmonton-004' },
      }),
    });
    expect(result.terminal.name).toBe('Edmonton-004');
  });

  it('rejects an empty terminal update', async () => {
    await expect(service.updateTerminal(1, {})).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('rejects receiving an asset already owned by the terminal', async () => {
    tx.terminal.findUnique.mockResolvedValue({
      id: 1,
      snapshot: {
        currentStatus: TerminalStatus.ACTIVE,
      },
    });
    tx.packageSnapshot.findUnique.mockResolvedValue({
      id: 'package-1',
      currentTerminalId: 1,
      currentContainerId: null,
      currentTrailerId: null,
    });

    await expect(
      service.receiveAsset(1, {
        assetType: TerminalAssetType.PACKAGE,
        assetIdentifier: 'PKG-1',
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('transfers a package and updates both terminal snapshots atomically', async () => {
    const now = new Date();
    tx.terminal.findUnique
      .mockResolvedValueOnce({
        id: 1,
        snapshot: {
          currentStatus: TerminalStatus.ACTIVE,
          packageCount: 1,
          containerCount: 0,
          trailerCount: 0,
        },
      })
      .mockResolvedValueOnce({
        id: 2,
        snapshot: {
          currentStatus: TerminalStatus.ACTIVE,
          packageCount: 0,
          containerCount: 0,
          trailerCount: 0,
        },
      });
    tx.packageSnapshot.findUnique.mockResolvedValue({
      id: 'package-1',
      currentTerminalId: 1,
      currentContainerId: null,
      currentTrailerId: null,
    });
    tx.packageSnapshot.updateMany.mockResolvedValue({ count: 1 });
    tx.terminalEvent.create
      .mockResolvedValueOnce({
        id: 'source-event',
        eventType: TerminalEventType.PACKAGE_TRANSFERRED,
        createdAt: now,
      })
      .mockResolvedValueOnce({
        id: 'destination-event',
        eventType: TerminalEventType.PACKAGE_RECEIVED,
        createdAt: now,
      });
    tx.terminalSnapshot.update
      .mockResolvedValueOnce({ terminalId: 1, packageCount: 0 })
      .mockResolvedValueOnce({ terminalId: 2, packageCount: 1 });

    const result = await service.transferAsset(1, {
      assetType: TerminalAssetType.PACKAGE,
      assetIdentifier: 'PKG-1',
      destinationTerminalId: 2,
    });

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(tx.packageSnapshot.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ['package-1'] } },
      data: { currentTerminalId: 2 },
    });
    expect(tx.terminalEvent.create).toHaveBeenCalledTimes(2);
    expect(tx.terminalSnapshot.update).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        where: { terminalId: 1 },
        data: expect.objectContaining({
          packageCount: { decrement: 1 },
        }),
      }),
    );
    expect(tx.terminalSnapshot.update).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        where: { terminalId: 2 },
        data: expect.objectContaining({
          packageCount: { increment: 1 },
        }),
      }),
    );
    expect(result.success).toBe(true);
  });
});
