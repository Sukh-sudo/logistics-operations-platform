export interface DashboardSummaryDto {
  packages: { received: number; sorted: number; inContainer: number; inTrailer: number; delivered: number };
  containers: { open: number; closed: number; loaded: number };
  trailers: { open: number; inTransit: number; arrived: number };
}
export interface RecentEventDto { assetType: 'PACKAGE' | 'CONTAINER' | 'TRAILER'; reference: string; event: string; occurredAt: string; }
