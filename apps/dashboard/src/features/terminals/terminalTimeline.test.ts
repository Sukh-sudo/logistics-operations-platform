import { describe, expect, it } from 'vitest';
import { toTerminalTimelineItem } from './terminalTimeline';

describe('terminal timeline', () => {
  it('preserves audit identifiers when formatting an event', () => {
    const item = toTerminalTimelineItem({ id: 'event-1', terminalId: 1, eventType: 'PACKAGE_RECEIVED', employeeId: 7, correlationId: 'request-1', createdAt: '2026-07-13T12:00:00Z' });
    expect(item.title).toBe('PACKAGE RECEIVED');
    expect(item.details).toEqual(['Employee 7', 'Correlation request-1']);
  });
});
