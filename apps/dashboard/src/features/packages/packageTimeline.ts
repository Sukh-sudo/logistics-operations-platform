import type { PackageEventDto } from '@logistics/shared-types';

export interface PackageTimelineItem {
  id: string;
  title: string;
  occurredAt: string;
  details: string[];
}

// Convert persistence-oriented event fields into concise operational timeline content.
export function toPackageTimelineItem(event: PackageEventDto): PackageTimelineItem {
  const details: string[] = [];
  if (event.terminalId != null) details.push(`Terminal ${event.terminalId}`);
  if (event.employeeId != null) details.push(`Employee ${event.employeeId}`);
  return { id: event.id, title: event.eventType.replaceAll('_', ' '), occurredAt: event.createdAt, details };
}
