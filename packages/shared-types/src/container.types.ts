export type ContainerStatus = 'OPEN' | 'CLOSED' | 'IN_TRANSIT' | 'ARRIVED';
export interface ContainerSnapshotDto { id: string; containerBarcode: string; currentStatus: ContainerStatus; currentTrailerId: string | null; currentTerminalId: number | null; packageCount: number; updatedAt: string; }
