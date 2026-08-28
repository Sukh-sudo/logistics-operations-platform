export interface DashboardSummaryDto {
  packages: { received: number; sorted: number; inContainer: number; inTrailer: number; departed: number; arrived: number; outForDelivery: number; delivered: number; attemptedDelivery: number; damaged: number; misrouted: number; returnedToTerminal: number };
  containers: { open: number; closed: number; loaded: number };
  trailers: { open: number; closed: number; inTransit: number; arrived: number };
}
export interface RecentEventDto { assetType: 'PACKAGE' | 'CONTAINER' | 'TRAILER'; reference: string; event: string; occurredAt: string; }
export interface DashboardTrailerDto { trailerBarcode: string; status: string; containerCount: number; packageCount: number; }
export interface DashboardContainerDto { containerBarcode: string; status: string; packageCount: number; assignedTrailer: string | null; }
export interface DashboardPackageDto {
  trackingNumber: string;
  status: string;
  containerBarcode: string | null;
  trailerBarcode: string | null;
  updatedAt: string;
  originTerminalId: number | null;
  destinationTerminalId: number | null;
}
export interface DashboardTerminalOptionDto { id: number; terminalCode: string; name: string; city: string; }
export interface TerminalPerformanceDto {
  id: number;
  terminalCode: string;
  name: string;
  city: string;
  province: string;
  currentStatus: string | null;
  inventory: { packages: number; containers: number; trailers: number; employees: number };
  metrics: {
    packagesProcessed: number;
    deliveredPackages: number;
    committedDeliveries: number;
    onTimeDeliveries: number;
    deliveryOnTimePerformance: number | null;
    lateDeliveries: number;
    deliveryAttempts: number;
    totalArrivals: number;
    onTimeArrivals: number;
    onTimePerformance: number | null;
    lateArrivals: number;
    inboundTrailers: number;
    outboundTrailers: number;
  };
}
export interface HandheldKpiDto {
  acceptedPackages: number;
  rejectedScans: number;
  duplicateScans: number;
  reversals: number;
  damagedPackages: number;
  misroutedPackages: number;
  gpsMissingEvents: number;
  synchronizationFailures: number;
  closedContainersNotLoaded: number;
  activeEmployees: number;
  operationallyInactiveEmployees: number;
  activeSeconds: number;
  terminalPackagesPerHour: number;
}
