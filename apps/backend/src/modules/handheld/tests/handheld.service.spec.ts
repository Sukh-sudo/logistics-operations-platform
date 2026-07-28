import {
  HandheldAction,
  HandheldNetworkState,
  HandheldResultStatus,
  HandheldSessionState,
  HandheldTaskType,
} from '@prisma/client';
import { HandheldService } from '../services/handheld.service';

describe('HandheldService', () => {
  const tx = {
    user: { findUnique: jest.fn() },
    handheldTaskSession: { create: jest.fn() },
    handheldTaskSessionEvent: { create: jest.fn() },
    handheldTaskSessionSnapshot: {
      create: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    handheldTaskInterval: { create: jest.fn(), updateMany: jest.fn() },
    handheldCommandReceipt: { create: jest.fn() },
  };
  const prisma = {
    $transaction: jest.fn((callback: (client: typeof tx) => unknown) =>
      callback(tx),
    ),
    handheldCommandReceipt: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    handheldTaskSession: { findUnique: jest.fn() },
  };
  let service: HandheldService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new HandheldService(
      prisma as never,
      {} as never,
      {} as never,
      {} as never,
    );
  });

  it('creates the session event, snapshot, and active interval in one transaction', async () => {
    tx.user.findUnique.mockResolvedValue({
      id: 'employee-1',
      primaryTerminalId: 10,
      snapshot: { currentState: 'ACTIVE' },
    });
    tx.handheldTaskSession.create.mockResolvedValue({
      id: 'session-1',
      employeeId: 'employee-1',
    });
    tx.handheldTaskSessionEvent.create.mockResolvedValue({
      id: 'event-1',
      createdAt: new Date('2026-07-28T12:00:00Z'),
    });
    tx.handheldTaskSessionSnapshot.create.mockResolvedValue({
      id: 'session-1',
      currentState: HandheldSessionState.ACTIVE,
    });

    const result = await service.startSession('employee-1', {
      deviceId: '8c808770-d3c8-4891-8382-f700e919aec3',
      taskType: HandheldTaskType.TRAILER_LOAD,
      networkState: HandheldNetworkState.ONLINE,
    });

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(tx.handheldTaskSessionEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ taskSessionId: 'session-1' }),
    });
    expect(tx.handheldTaskInterval.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ taskSessionId: 'session-1' }),
    });
    expect(result.snapshot.currentState).toBe(HandheldSessionState.ACTIVE);
  });

  it('returns the original accepted result as duplicate without executing the domain command', async () => {
    prisma.handheldCommandReceipt.findUnique.mockResolvedValue({
      id: 'receipt-1',
      clientEventId: 'f0533e46-9466-45a6-9638-188b13ce8efe',
      resultStatus: HandheldResultStatus.ACCEPTED,
    });
    prisma.handheldCommandReceipt.update.mockResolvedValue({
      id: 'receipt-1',
      clientEventId: 'f0533e46-9466-45a6-9638-188b13ce8efe',
      resultStatus: HandheldResultStatus.ACCEPTED,
      duplicateCount: 1,
    });
    const dispatch = jest.spyOn(
      service as unknown as { dispatchDomainCommand: () => Promise<void> },
      'dispatchDomainCommand',
    );

    const result = await service.processScan(
      'session-1',
      'employee-1',
      scanDto(),
    );

    expect(result.resultStatus).toBe(HandheldResultStatus.DUPLICATE_ACCEPTED);
    expect(dispatch).not.toHaveBeenCalled();
  });

  it('adds GPS_MISSING without rejecting delivery work', async () => {
    prisma.handheldCommandReceipt.findUnique.mockResolvedValue(null);
    prisma.handheldTaskSession.findUnique.mockResolvedValue({
      id: 'session-1',
      employeeId: 'employee-1',
      deviceId: '8c808770-d3c8-4891-8382-f700e919aec3',
      taskType: HandheldTaskType.COURIER_DELIVERY,
      snapshot: { currentState: HandheldSessionState.ACTIVE },
    });
    jest
      .spyOn(
        service as unknown as {
          dispatchDomainCommand: (
            dto: unknown,
            correlationId: string,
            terminalId: number,
            hook: (client: typeof tx, eventId: string) => Promise<unknown>,
          ) => Promise<unknown>;
        },
        'dispatchDomainCommand',
      )
      .mockImplementation((_dto, _correlationId, _terminalId, hook) =>
        hook(tx, 'package-event-1'),
      );
    tx.handheldTaskSessionSnapshot.findUnique.mockResolvedValue({
      currentState: HandheldSessionState.ACTIVE,
    });
    tx.handheldCommandReceipt.create.mockImplementation(({ data }) =>
      Promise.resolve({ id: 'receipt-1', ...data }),
    );
    tx.handheldTaskSessionEvent.create.mockResolvedValue({
      id: 'activity-1',
      createdAt: new Date(),
    });

    const result = await service.processScan(
      'session-1',
      'employee-1',
      scanDto(),
    );

    expect(result.resultStatus).toBe(HandheldResultStatus.ACCEPTED);
    expect(result.exceptionFlags).toContain('GPS_MISSING');
  });

  function scanDto() {
    return {
      taskSessionId: 'session-1',
      clientEventId: 'f0533e46-9466-45a6-9638-188b13ce8efe',
      action: HandheldAction.PACKAGE_DELIVERED,
      deviceId: '8c808770-d3c8-4891-8382-f700e919aec3',
      deviceTimestamp: '2026-07-28T12:00:00.000Z',
      networkStateAtCapture: HandheldNetworkState.OFFLINE_NETWORK,
      trackingNumber: 'PKG-TEST-1',
    };
  }
});
