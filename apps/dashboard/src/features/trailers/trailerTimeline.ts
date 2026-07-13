import type { TrailerEventDto } from '@logistics/shared-types';

// Trailer events remain immutable; this adapter only prepares them for display.
export const toTrailerTimelineItem = (event: TrailerEventDto) => ({
  id: event.id,
  title: event.eventType.replaceAll('_', ' '),
  occurredAt: event.createdAt,
  details: [],
});
