import type { ShipmentEventDto } from '@logistics/shared-types';
import { formatEventData } from '../events/eventAudit';

// Preserve correlation identifiers so support teams can trace shipment transactions.
export const toShipmentTimelineItem = (event: ShipmentEventDto) => {
  const payload = formatEventData('Payload', event.payload);
  return {
    id: event.id,
    title: event.eventType.replaceAll('_', ' '),
    occurredAt: event.createdAt,
    details: [
      event.correlationId ? `Correlation ${event.correlationId}` : '',
      event.sourcePackageEventId ? `Source package event ${event.sourcePackageEventId}` : '',
      payload ?? '',
    ].filter(Boolean),
  };
};
