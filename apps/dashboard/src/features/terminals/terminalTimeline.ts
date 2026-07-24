import type { TerminalEventDto } from '@logistics/shared-types';
import { formatEventData } from '../events/eventAudit';

// Immutable terminal events are adapted for display without deriving current state.
export const toTerminalTimelineItem = (event: TerminalEventDto) => {
  const payload = formatEventData('Payload', event.payload);
  return {
    id: event.id,
    title: event.eventType.replaceAll('_', ' '),
    occurredAt: event.createdAt,
    details: [event.employeeId != null ? `Employee ${event.employeeId}` : '', event.correlationId ? `Correlation ${event.correlationId}` : '', payload ?? ''].filter(Boolean),
  };
};
