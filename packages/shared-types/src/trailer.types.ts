export type TrailerStatus = 'OPEN' | 'CLOSED' | 'IN_TRANSIT' | 'ARRIVED';
export type TrailerEventType = 'TRAILER_CREATED' | 'TRAILER_CLOSED' | 'TRAILER_DEPARTED' | 'TRAILER_ARRIVED' | 'CONTAINER_LOADED_TO_TRAILER' | 'CONTAINER_UNLOADED_FROM_TRAILER' | 'PACKAGE_LOADED_TO_TRAILER' | 'PACKAGE_UNLOADED_FROM_TRAILER';
export interface CreateTrailerDto { trailerBarcode: string; terminalId: number; }
export interface TrailerContainerActionDto { containerBarcode: string; }
export interface TrailerPackageActionDto { trackingNumber: string; }
export interface TrailerSnapshotDto { id: string; trailerBarcode: string; currentStatus: TrailerStatus; currentTerminalId: number | null; containerCount: number; packageCount: number; updatedAt: string; }
export interface TrailerEventDto { id: string; trailerId: string; eventType: TrailerEventType; employeeId: number | null; correlationId: string; metadata: unknown | null; createdAt: string; }
export interface TrailerContainersDto { trailerBarcode: string; containerCount: number; containers: import('./container.types.js').ContainerSnapshotDto[]; }
export interface TrailerPackageDto { trackingNumber: string; currentStatus: string; location: 'CONTAINER' | 'LOOSE'; containerBarcode: string | null; }
export interface TrailerPackagesDto { trailerBarcode: string; packageCount: number; packages: TrailerPackageDto[]; }
