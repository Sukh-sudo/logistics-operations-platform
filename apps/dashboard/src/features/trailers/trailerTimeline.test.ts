import type { TrailerEventDto } from '@logistics/shared-types';
import { describe, expect, it } from 'vitest';
import { toTrailerTimelineItem } from './trailerTimeline';

describe('trailer timeline', () => {
  it('includes immutable event audit references and metadata', () => {
    const event: TrailerEventDto = {
      id: 'event-1',
      trailerId: 'trailer-1',
      eventType: 'CONTAINER_LOADED_TO_TRAILER',
      employeeId: 12,
      correlationId: 'request-1',
      metadata: { containerBarcode: 'CON1234567' },
      createdAt: '2026-07-24T12:00:00Z',
    };

    expect(toTrailerTimelineItem(event)).toEqual({
      id: 'event-1',
      title: 'CONTAINER LOADED TO TRAILER',
      occurredAt: event.createdAt,
      details: ['Employee 12', 'Correlation request-1', 'Metadata {"containerBarcode":"CON1234567"}'],
    });
  });
});
