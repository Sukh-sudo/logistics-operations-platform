import type { TerminalDto } from './terminal.types.js';

export interface TripStopDto { id: string; tripId: string; terminalId: number; sequence: number; plannedArrival: string; actualArrival: string | null; plannedDeparture: string; actualDeparture: string | null; status: string; delayMinutes: number; notes: string | null; terminal: TerminalDto; }
export interface TripSnapshotDto { currentStatus: string; currentStopId: string | null; nextStopId: string | null; currentTerminalId: number | null; completedStops: number; totalStops: number; progressPercent: number; delayMinutes: number; lastActivityAt: string | null; }
export interface TripRouteDto { id: string; routeNumber: string; name: string; originTerminalId: number; destinationTerminalId: number; estimatedDistance: number; estimatedDuration: number; status: string; }
export interface TripDetailDto { id: string; tripNumber: string; routeId: string; equipmentAssignmentId: string | null; status: string; plannedDeparture: string; actualDeparture: string | null; plannedArrival: string; actualArrival: string | null; createdAt: string; updatedAt: string; route: TripRouteDto; stops: TripStopDto[]; snapshot: TripSnapshotDto | null; }
