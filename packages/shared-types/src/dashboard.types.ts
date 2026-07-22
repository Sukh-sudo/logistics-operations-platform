export interface DashboardSummaryDto {
  packages: { received: number; sorted: number; inContainer: number; inTrailer: number; departed: number; arrived: number; outForDelivery: number; delivered: number };
  containers: { open: number; closed: number; loaded: number };
  trailers: { open: number; closed: number; inTransit: number; arrived: number };
}
export interface RecentEventDto { assetType: 'PACKAGE' | 'CONTAINER' | 'TRAILER'; reference: string; event: string; occurredAt: string; }
export interface DashboardTrailerDto { trailerBarcode: string; status: string; containerCount: number; packageCount: number; }
export interface DashboardContainerDto { containerBarcode: string; status: string; packageCount: number; assignedTrailer: string | null; }
export interface DashboardPackageDto { trackingNumber: string; status: string; containerBarcode: string | null; trailerBarcode: string | null; }
export interface DashboardTerminalOptionDto { id: number; terminalCode: string; name: string; city: string; }
