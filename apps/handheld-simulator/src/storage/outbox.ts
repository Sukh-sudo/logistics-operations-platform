import type { OutboxEvent, ScanResult, SyncState } from '../domain/types';

const unresolved: SyncState[] = ['PENDING', 'PENDING_VALIDATION', 'SYNCING'];

export function isPending(event: OutboxEvent) {
  return unresolved.includes(event.syncState);
}

export function applyResult(event: OutboxEvent, result: ScanResult): OutboxEvent {
  const syncState: SyncState =
    result.status === 'REJECTED'
      ? 'REJECTED_ACTION_REQUIRED'
      : result.status;
  return {
    ...event,
    syncState,
    message: result.message,
    code: result.code,
    serverEventId: result.serverEventId,
    receiptId: result.id,
    serverReceivedAt: result.serverReceivedAt,
    exceptionFlags: result.exceptionFlags ?? [],
    resolvedAt: new Date().toISOString(),
  };
}

export function replaceEvent(events: OutboxEvent[], updated: OutboxEvent) {
  return events.map((event) =>
    event.clientEventId === updated.clientEventId ? updated : event,
  );
}

export function purgeResolvedEvents(
  events: OutboxEvent[],
  now: number,
  retentionHours: number,
) {
  const cutoff = now - retentionHours * 60 * 60 * 1_000;
  return events.filter((event) => {
    // Pending and actionable rejected events are never removed automatically.
    if (isPending(event) || event.syncState === 'REJECTED_ACTION_REQUIRED') return true;
    const resolvedAt = event.resolvedAt ?? event.createdAt;
    return new Date(resolvedAt).getTime() >= cutoff;
  });
}
