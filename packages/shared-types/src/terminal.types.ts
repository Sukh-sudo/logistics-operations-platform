import type { ContainerSnapshotDto } from './container.types.js';
import type { PackageSnapshotDto } from './package.types.js';
import type { TrailerSnapshotDto } from './trailer.types.js';

export type TerminalAssetType = 'PACKAGE' | 'CONTAINER' | 'TRAILER';
export interface TransferTerminalAssetDto { assetType: TerminalAssetType; assetIdentifier: string; employeeId?: number; destinationTerminalId: number; }
export interface TerminalSnapshotDto { currentStatus: string; packageCount: number; containerCount: number; trailerCount: number; truckCount: number; activeTripCount: number; employeeCount: number; lastActivityAt: string | null; }
export interface TerminalDto { id: number; terminalCode: string; name: string; city: string; province: string; country: string; timezone: string; createdAt: string; updatedAt: string; snapshot: TerminalSnapshotDto | null; }
export interface TerminalEventDto { id: string; terminalId: number; eventType: string; employeeId: number | null; correlationId: string; payload?: unknown; createdAt: string; }
export interface TerminalInventoryDto { terminalId: number; terminalCode: string; snapshot: TerminalSnapshotDto | null; packages: PackageSnapshotDto[]; containers: ContainerSnapshotDto[]; trailers: TrailerSnapshotDto[]; }
export interface TerminalOperationsDto { terminalId: number; terminalCode: string; status: string | null; activeTripCount: number; employeeCount: number; lastActivityAt: string | null; recentEvents: TerminalEventDto[]; }
export interface TerminalEmployeeDto { id: string; employeeNumber: string; email: string; firstName: string; lastName: string; currentStatus: string; roleNames: string[]; lastActivityAt: string | null; }
export interface TerminalMovementDto { id: string; direction: 'INBOUND' | 'OUTBOUND'; tripId: string; tripNumber: string; trailerBarcode: string | null; plannedAt: string; actualAt: string; delayMinutes: number; }
