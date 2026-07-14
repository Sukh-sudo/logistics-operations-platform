import type { TerminalEventDto } from '@logistics/shared-types';

// Immutable terminal events are adapted for display without deriving current state.
export const toTerminalTimelineItem = (event: TerminalEventDto) => ({
  id: event.id,
  title: event.eventType.replaceAll('_', ' '),
  occurredAt: event.createdAt,
  details: [event.employeeId != null ? `Employee ${event.employeeId}` : '', event.correlationId ? `Correlation ${event.correlationId}` : ''].filter(Boolean),
});
