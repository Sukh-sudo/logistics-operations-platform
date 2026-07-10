import type { PackageType } from './package.types.js';
export type ContainerStatus = 'OPEN' | 'CLOSED' | 'IN_TRANSIT' | 'ARRIVED';
export type ContainerEventType = 'CONTAINER_CREATED' | 'CONTAINER_CLOSED' | 'CONTAINER_DEPARTED' | 'CONTAINER_ARRIVED';
export interface ContainerSnapshotDto { id: string; containerBarcode: string; packageType: PackageType; currentStatus: ContainerStatus; currentTrailerId: string | null; currentTerminalId: number | null; packageCount: number; updatedAt: string; }
export interface ContainerEventDto { id: string; containerId: string; eventType: ContainerEventType; employeeId: number | null; metadata: unknown | null; createdAt: string; }
