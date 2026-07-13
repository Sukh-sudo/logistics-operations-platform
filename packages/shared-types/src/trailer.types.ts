export type TrailerStatus = 'OPEN' | 'CLOSED' | 'IN_TRANSIT' | 'ARRIVED';
export interface TrailerSnapshotDto { id: string; trailerBarcode: string; currentStatus: TrailerStatus; currentTerminalId: number | null; containerCount: number; packageCount: number; updatedAt: string; }
export interface TrailerEventDto { id: string; trailerId: string; eventType: string; createdAt: string; }
export interface TrailerContainersDto { trailerBarcode: string; containerCount: number; containers: import('./container.types.js').ContainerSnapshotDto[]; }
export interface TrailerPackageDto { trackingNumber: string; currentStatus: string; location: 'CONTAINER' | 'LOOSE'; containerBarcode: string | null; }
export interface TrailerPackagesDto { trailerBarcode: string; packageCount: number; packages: TrailerPackageDto[]; }
