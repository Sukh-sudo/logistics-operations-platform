import type { ShipmentEventDto } from '@logistics/shared-types';

// Preserve correlation identifiers so support teams can trace shipment transactions.
export const toShipmentTimelineItem = (event: ShipmentEventDto) => ({
  id: event.id,
  title: event.eventType.replaceAll('_', ' '),
  occurredAt: event.createdAt,
  details: event.correlationId ? [`Correlation ${event.correlationId}`] : [],
});
