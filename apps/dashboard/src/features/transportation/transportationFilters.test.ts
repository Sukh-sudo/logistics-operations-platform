import { describe, expect, it } from 'vitest';
import type { Route, Shipment, Terminal, Trip } from '../../services/transportation.api';
import { emptyTransportationFilters, filterRoutes, filterShipments, filterTerminals, filterTrips } from './transportationFilters';

const terminal = (id: number, createdAt = '2026-07-01T10:00:00.000Z') => ({ id, createdAt } as Terminal);
describe('transportation filters', () => {
  it('filters terminal records by creation date', () => {
    expect(filterTerminals([terminal(1), terminal(2, '2026-07-02T10:00:00.000Z')], { ...emptyTransportationFilters, date: '2026-07-02' }).map(item => item.id)).toEqual([2]);
  });
  it('combines date, origin, and destination for routes', () => {
    const routes = [{ id: 'match', createdAt: '2026-07-02T01:00:00Z', originTerminalId: 1, destinationTerminalId: 2 }, { id: 'wrong-lane', createdAt: '2026-07-02T01:00:00Z', originTerminalId: 2, destinationTerminalId: 1 }] as Route[];
    expect(filterRoutes(routes, { date: '2026-07-02', originId: '1', destinationId: '2' }).map(item => item.id)).toEqual(['match']);
  });
  it('uses planned departure as the trip date and route terminals as its lane', () => {
    const trips = [{ id: 'match', plannedDeparture: '2026-07-03T18:00:00Z', route: { originTerminalId: 1, destinationTerminalId: 2 } }, { id: 'other-day', plannedDeparture: '2026-07-04T18:00:00Z', route: { originTerminalId: 1, destinationTerminalId: 2 } }] as Trip[];
    expect(filterTrips(trips, { date: '2026-07-03', originId: '1', destinationId: '2' }).map(item => item.id)).toEqual(['match']);
  });
  it('keeps all shipments when filters are clear and narrows them when combined', () => {
    const shipments = [{ id: 'match', createdAt: '2026-07-02T01:00:00Z', originTerminalId: 1, destinationTerminalId: 2 }, { id: 'other', createdAt: '2026-07-02T01:00:00Z', originTerminalId: 1, destinationTerminalId: 3 }] as Shipment[];
    expect(filterShipments(shipments, emptyTransportationFilters)).toHaveLength(2);
    expect(filterShipments(shipments, { date: '2026-07-02', originId: '1', destinationId: '2' }).map(item => item.id)).toEqual(['match']);
  });
});
