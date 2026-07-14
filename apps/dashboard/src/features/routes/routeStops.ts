import type { RouteDetailDto } from '@logistics/shared-types';

export interface DisplayRouteStop { key: string; sequence: number; label: string; terminalId: number; arrivalOffset: number; departureOffset: number; endpoint: boolean; }

// Add route endpoints around the persisted intermediate stops for one ordered itinerary.
export const buildRouteStops = (route: RouteDetailDto): DisplayRouteStop[] => [
  { key: 'origin', sequence: 0, label: route.originTerminal.name, terminalId: route.originTerminalId, arrivalOffset: 0, departureOffset: 0, endpoint: true },
  ...route.stops.map(stop => ({ key: stop.id, sequence: stop.sequence, label: stop.terminal.name, terminalId: stop.terminalId, arrivalOffset: stop.estimatedArrivalOffset, departureOffset: stop.estimatedDepartureOffset, endpoint: false })),
  { key: 'destination', sequence: route.stops.length + 1, label: route.destinationTerminal.name, terminalId: route.destinationTerminalId, arrivalOffset: route.estimatedDuration, departureOffset: route.estimatedDuration, endpoint: true },
];
