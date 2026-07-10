import type { ContainerEventDto } from '@logistics/shared-types';

export interface ContainerTimelineItem {
  id: string;
  title: string;
  occurredAt: string;
  details: string[];
}

// Convert immutable container events into the compact timeline model used by detail pages.
export function toContainerTimelineItem(event: ContainerEventDto): ContainerTimelineItem {
  const details: string[] = [];
  if (event.employeeId != null) details.push(`Employee ${event.employeeId}`);
  return { id: event.id, title: event.eventType.replaceAll('_', ' '), occurredAt: event.createdAt, details };
}
