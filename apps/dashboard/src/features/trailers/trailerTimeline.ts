import type { TrailerEventDto } from '@logistics/shared-types';
import { formatEventData } from '../events/eventAudit';

// Trailer events remain immutable; this adapter only prepares them for display.
export const toTrailerTimelineItem = (event: TrailerEventDto) => {
  const metadata = formatEventData('Metadata', event.metadata);
  return {
    id: event.id,
    title: event.eventType.replaceAll('_', ' '),
    occurredAt: event.createdAt,
    details: [
      event.employeeId != null ? `Employee ${event.employeeId}` : '',
      event.correlationId ? `Correlation ${event.correlationId}` : '',
      metadata ?? '',
    ].filter(Boolean),
  };
};
