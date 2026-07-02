export type PackageStatus = 'RECEIVED' | 'SORTED' | 'IN_CONTAINER' | 'IN_TRAILER' | 'DEPARTED' | 'ARRIVED' | 'OUT_FOR_DELIVERY' | 'DELIVERED';
export interface PackageSnapshotDto { id: string; trackingNumber: string; currentStatus: PackageStatus; currentTerminalId: number | null; currentContainerId: string | null; currentTrailerId: string | null; updatedAt: string; }
