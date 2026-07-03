export type PackageStatus = 'RECEIVED' | 'SORTED' | 'IN_CONTAINER' | 'IN_TRAILER' | 'DEPARTED' | 'ARRIVED' | 'OUT_FOR_DELIVERY' | 'DELIVERED';
export type PackageType = 'MAIL' | 'CONVEYABLE' | 'NON_CONVEYABLE' | 'DANGEROUS_GOODS';
export interface PackageSnapshotDto { id: string; trackingNumber: string; packageType: PackageType; currentStatus: PackageStatus; currentTerminalId: number | null; currentContainerId: string | null; currentTrailerId: string | null; updatedAt: string; }
