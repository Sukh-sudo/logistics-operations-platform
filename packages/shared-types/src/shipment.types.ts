import type { PackageSnapshotDto } from './package.types.js';
import type { TerminalDto } from './terminal.types.js';

export interface ShipmentSnapshotDto { currentStatus: string; currentTerminalId: number | null; packageCount: number; deliveredPackages: number; outForDeliveryPackages: number; remainingPackages: number; progressPercent: number; completedAt: string | null; lastActivityAt: string | null; }
export interface ShipmentEventDto { id: string; shipmentId: string; eventType: string; correlationId: string; payload?: unknown; createdAt: string; }
export interface ShipmentDetailDto { id: string; shipmentNumber: string; referenceNumber: string | null; status: string; originTerminalId: number; destinationTerminalId: number; createdAt: string; updatedAt: string; originTerminal: TerminalDto; destinationTerminal: TerminalDto; snapshot: ShipmentSnapshotDto | null; packages: Array<{ shipmentId: string; packageId: string; assignedAt: string; package: PackageSnapshotDto }>; }

export interface TrackingTerminalDto {
  terminalCode: string;
  name: string;
  city: string;
  province: string;
  country: string;
}

export interface ShipmentTrackingDto {
  shipmentNumber: string;
  referenceNumber: string | null;
  status: string;
  origin: TrackingTerminalDto;
  destination: TrackingTerminalDto;
  currentTerminal: TrackingTerminalDto | null;
  progress: {
    packageCount: number;
    deliveredPackages: number;
    outForDeliveryPackages: number;
    remainingPackages: number;
    progressPercent: number;
    completedAt: string | null;
    lastActivityAt: string | null;
  };
  packages: Array<{
    trackingNumber: string;
    status: string;
    lastUpdatedAt: string;
  }>;
  milestones: Array<{
    type: string;
    occurredAt: string;
  }>;
}
