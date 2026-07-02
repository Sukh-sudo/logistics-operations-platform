export type TrailerStatus = 'OPEN' | 'CLOSED' | 'IN_TRANSIT' | 'ARRIVED';
export interface TrailerSnapshotDto { id: string; trailerBarcode: string; currentStatus: TrailerStatus; currentTerminalId: number | null; containerCount: number; packageCount: number; updatedAt: string; }
