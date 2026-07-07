export type PackageStatus = 'RECEIVED' | 'SORTED' | 'IN_CONTAINER' | 'IN_TRAILER' | 'DEPARTED' | 'ARRIVED' | 'OUT_FOR_DELIVERY' | 'DELIVERED';
export type PackageType = 'MAIL' | 'CONVEYABLE' | 'NON_CONVEYABLE' | 'DANGEROUS_GOODS';
export type PackageEventType = 'PACKAGE_RECEIVED' | 'PACKAGE_SORTED' | 'PACKAGE_LOADED_TO_CONTAINER' | 'PACKAGE_UNLOADED_FROM_CONTAINER' | 'PACKAGE_LOADED_TO_TRAILER' | 'PACKAGE_UNLOADED_FROM_TRAILER' | 'PACKAGE_DEPARTED' | 'PACKAGE_ARRIVED' | 'PACKAGE_OUT_FOR_DELIVERY' | 'PACKAGE_DELIVERED';
export interface PackageSnapshotDto { id: string; trackingNumber: string; packageType: PackageType; currentStatus: PackageStatus; currentTerminalId: number | null; currentContainerId: string | null; currentTrailerId: string | null; updatedAt: string; }
export interface PackageLocationDto { trackingNumber: string; currentStatus: PackageStatus; containerBarcode: string | null; trailerBarcode: string | null; }
export interface PackageEventDto { id: string; packageId: string; eventType: PackageEventType; terminalId: number | null; employeeId: number | null; metadata: unknown | null; createdAt: string; }
