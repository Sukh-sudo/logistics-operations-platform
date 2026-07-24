export interface DeliveryReportFilters {
  fromDate?: string;
  toDate?: string;
  originTerminalId?: number;
  destinationTerminalId?: number;
}

export interface DeliveryReportDto {
  filters: {
    fromDate: string | null;
    toDate: string | null;
    originTerminalId: number | null;
    destinationTerminalId: number | null;
  };
  totals: {
    totalShipments: number;
    completedShipments: number;
    activeShipments: number;
    cancelledShipments: number;
    totalPackages: number;
    deliveredPackages: number;
    completionRate: number;
  };
  statusBreakdown: Record<string, number>;
  deliveries: Array<{
    shipmentNumber: string;
    status: string | null;
    packageCount: number;
    deliveredPackages: number;
    progressPercent: number;
    createdAt: string;
    completedAt: string | null;
  }>;
}
