import type { PackageEventDto } from '@logistics/shared-types';
import { describe, expect, it } from 'vitest';
import { toPackageTimelineItem } from './packageTimeline';

describe('toPackageTimelineItem', () => {
  it('formats event names and includes available audit references', () => {
    const event: PackageEventDto = { id: 'event-1', packageId: 'package-1', eventType: 'PACKAGE_LOADED_TO_CONTAINER', terminalId: 4, employeeId: 12, metadata: null, createdAt: '2026-07-07T12:00:00Z' };
    expect(toPackageTimelineItem(event)).toEqual({ id: 'event-1', title: 'PACKAGE LOADED TO CONTAINER', occurredAt: event.createdAt, details: ['Terminal 4', 'Employee 12'] });
  });

  it('omits missing optional audit references', () => {
    const event: PackageEventDto = { id: 'event-2', packageId: 'package-1', eventType: 'PACKAGE_RECEIVED', terminalId: null, employeeId: null, metadata: null, createdAt: '2026-07-07T12:00:00Z' };
    expect(toPackageTimelineItem(event).details).toEqual([]);
  });
});
