import type { ContainerEventDto } from '@logistics/shared-types';
import { describe, expect, it } from 'vitest';
import { toContainerTimelineItem } from './containerTimeline';

describe('toContainerTimelineItem', () => {
  it('maps a container event into a readable timeline entry', () => {
    const event: ContainerEventDto = { id: 'event-1', containerId: 'container-1', eventType: 'CONTAINER_CLOSED', employeeId: 42, metadata: null, createdAt: '2026-07-08T14:00:00Z' };

    expect(toContainerTimelineItem(event)).toEqual({
      id: 'event-1',
      title: 'CONTAINER CLOSED',
      occurredAt: '2026-07-08T14:00:00Z',
      details: ['Employee 42'],
    });
  });
});
