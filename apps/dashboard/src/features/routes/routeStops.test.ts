import { describe, expect, it } from 'vitest';
import { buildRouteStops } from './routeStops';

describe('route stop display', () => {
  it('places intermediate stops between the origin and destination', () => {
    const route = { originTerminalId: 1, destinationTerminalId: 3, estimatedDuration: 120, originTerminal: { name: 'Calgary' }, destinationTerminal: { name: 'Edmonton' }, stops: [{ id: 'stop-1', sequence: 1, terminalId: 2, estimatedArrivalOffset: 50, estimatedDepartureOffset: 60, terminal: { name: 'Red Deer' } }] } as never;
    expect(buildRouteStops(route).map(stop => stop.label)).toEqual(['Calgary', 'Red Deer', 'Edmonton']);
  });
});
