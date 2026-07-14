import { describe, expect, it } from 'vitest';
import { toShipmentTimelineItem } from './shipmentTimeline';

describe('shipment timeline', () => {
  it('formats event names while retaining transaction correlation', () => {
    const item = toShipmentTimelineItem({ id: 'event-1', shipmentId: 'shipment-1', eventType: 'PACKAGE_ASSIGNED', correlationId: 'request-1', createdAt: '2026-07-13T12:00:00Z' });
    expect(item.title).toBe('PACKAGE ASSIGNED');
    expect(item.details).toEqual(['Correlation request-1']);
  });
});
