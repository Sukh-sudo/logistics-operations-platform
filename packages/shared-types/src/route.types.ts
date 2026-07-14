import type { TerminalDto } from './terminal.types.js';

export interface RouteStopDto { id: string; terminalId: number; sequence: number; estimatedArrivalOffset: number; estimatedDepartureOffset: number; terminal: TerminalDto; }
export interface RouteSnapshotDto { currentStatus: string; stopCount: number; estimatedDistance: number; estimatedDuration: number; lastActivityAt: string | null; }
export interface RouteDetailDto { id: string; routeNumber: string; name: string; status: string; estimatedDistance: number; estimatedDuration: number; createdAt: string; updatedAt: string; originTerminalId: number; destinationTerminalId: number; originTerminal: TerminalDto; destinationTerminal: TerminalDto; stops: RouteStopDto[]; snapshot: RouteSnapshotDto | null; }
