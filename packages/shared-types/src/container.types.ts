import type { PackageType } from './package.types.js';
export type ContainerStatus = 'OPEN' | 'CLOSED' | 'IN_TRANSIT' | 'ARRIVED';
export type ContainerEventType = 'CONTAINER_CREATED' | 'PACKAGE_LOADED' | 'PACKAGE_UNLOADED' | 'CONTAINER_LOADED_TO_TRAILER' | 'CONTAINER_UNLOADED_FROM_TRAILER' | 'CONTAINER_CLOSED' | 'CONTAINER_DEPARTED' | 'CONTAINER_ARRIVED';
export interface CreateContainerDto { containerBarcode: string; terminalId: number; }
export interface ContainerPackageActionDto { trackingNumber: string; }
export interface ContainerSnapshotDto { id: string; containerBarcode: string; packageType: PackageType; currentStatus: ContainerStatus; currentTrailerId: string | null; currentTerminalId: number | null; packageCount: number; updatedAt: string; }
export interface ContainerEventDto { id: string; containerId: string; eventType: ContainerEventType; employeeId: number | null; correlationId: string; metadata: unknown | null; createdAt: string; }
