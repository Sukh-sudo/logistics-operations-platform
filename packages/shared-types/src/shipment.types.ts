import type { PackageSnapshotDto } from './package.types.js';
import type { TerminalDto } from './terminal.types.js';

export interface ShipmentSnapshotDto { currentStatus: string; packageCount: number; deliveredPackages: number; remainingPackages: number; progressPercent: number; lastActivityAt: string | null; }
export interface ShipmentEventDto { id: string; shipmentId: string; eventType: string; correlationId: string; payload?: unknown; createdAt: string; }
export interface ShipmentDetailDto { id: string; shipmentNumber: string; referenceNumber: string | null; status: string; originTerminalId: number; destinationTerminalId: number; createdAt: string; updatedAt: string; originTerminal: TerminalDto; destinationTerminal: TerminalDto; snapshot: ShipmentSnapshotDto | null; packages: Array<{ shipmentId: string; packageId: string; assignedAt: string; package: PackageSnapshotDto }>; }
