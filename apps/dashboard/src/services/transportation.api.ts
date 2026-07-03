import { apiClient } from './apiClient';
export interface Snapshot { currentStatus: string; packageCount?: number; containerCount?: number; trailerCount?: number; activeTripCount?: number; progressPercent?: number; delayMinutes?: number; stopCount?: number; }
export interface Terminal { id: number; terminalCode: string; name: string; city: string; province: string; country: string; snapshot: Snapshot | null; }
export interface RouteStop { id: string; sequence: number; terminal: Terminal; }
export interface Route { id: string; routeNumber: string; name: string; status: string; estimatedDistance: number; estimatedDuration: number; originTerminal: Terminal; destinationTerminal: Terminal; stops: RouteStop[]; snapshot: Snapshot | null; }
export interface Trip { id: string; tripNumber: string; status: string; plannedDeparture: string; plannedArrival: string; route: Pick<Route, 'routeNumber' | 'name'>; stops: { id: string; sequence: number; status: string; delayMinutes: number }[]; snapshot: Snapshot | null; }
export interface Shipment { id: string; shipmentNumber: string; referenceNumber: string | null; status: string; originTerminalId: number; destinationTerminalId: number; packages: unknown[]; snapshot: Snapshot | null; }
const read = async <T>(path: string) => (await apiClient.get<T>(path)).data;
export const transportationApi = { terminals: () => read<Terminal[]>('/terminals'), routes: () => read<Route[]>('/routes'), trips: () => read<Trip[]>('/trips'), shipments: () => read<Shipment[]>('/shipments') };
