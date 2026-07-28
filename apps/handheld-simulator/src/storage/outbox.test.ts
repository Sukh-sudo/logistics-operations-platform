import { describe, expect, it } from 'vitest';
import type { OutboxEvent, ScanResult } from '../domain/types';
import { applyResult, purgeResolvedEvents } from './outbox';

const baseEvent: OutboxEvent = {
  taskSessionId: 'session-1',
  clientEventId: 'event-1',
  action: 'LOAD_PACKAGE_TO_TRAILER',
  deviceId: 'device-1',
  deviceTimestamp: '2026-07-28T10:00:00.000Z',
  networkStateAtCapture: 'OFFLINE_NETWORK',
  trackingNumber: 'PKG-1',
  trailerBarcode: 'TRL-1',
  syncState: 'PENDING_VALIDATION',
  message: 'Queued',
  exceptionFlags: [],
  retryCount: 0,
  createdAt: '2026-07-28T10:00:00.000Z',
};

describe('handheld outbox', () => {
  it('maps a rejected server result to an actionable local state', () => {
    const result: ScanResult = {
      id: 'receipt-1',
      clientEventId: 'event-1',
      status: 'REJECTED',
      resultStatus: 'REJECTED',
      serverEventId: 'receipt-1',
      code: 'PACKAGE_WRONG_TERMINAL',
      message: 'Package belongs to another terminal.',
    };

    expect(applyResult(baseEvent, result)).toMatchObject({
      syncState: 'REJECTED_ACTION_REQUIRED',
      receiptId: 'receipt-1',
      code: 'PACKAGE_WRONG_TERMINAL',
    });
  });

  it('never purges unresolved or actionable rejected work', () => {
    const old = '2026-07-27T01:00:00.000Z';
    const retained = purgeResolvedEvents(
      [
        { ...baseEvent, createdAt: old },
        { ...baseEvent, clientEventId: 'event-2', createdAt: old, syncState: 'REJECTED_ACTION_REQUIRED' },
      ],
      new Date('2026-07-28T12:00:00.000Z').getTime(),
      8,
    );

    expect(retained).toHaveLength(2);
  });

  it('purges only resolved history older than the retention window', () => {
    const now = new Date('2026-07-28T12:00:00.000Z').getTime();
    const retained = purgeResolvedEvents(
      [
        { ...baseEvent, syncState: 'ACCEPTED', resolvedAt: '2026-07-28T08:00:00.000Z' },
        { ...baseEvent, clientEventId: 'old', syncState: 'ACCEPTED', resolvedAt: '2026-07-27T08:00:00.000Z' },
      ],
      now,
      8,
    );

    expect(retained.map((event) => event.clientEventId)).toEqual(['event-1']);
  });
});
