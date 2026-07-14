import type { TripStopDto } from '@logistics/shared-types';

// Stop state is already event-derived by the backend; this only selects display labels.
export const tripStopTiming = (stop: TripStopDto) => ({
  arrival: stop.actualArrival ?? stop.plannedArrival,
  departure: stop.actualDeparture ?? stop.plannedDeparture,
  arrivalActual: Boolean(stop.actualArrival),
  departureActual: Boolean(stop.actualDeparture),
});

export const clampProgress = (value?: number) => Math.min(100, Math.max(0, value ?? 0));
