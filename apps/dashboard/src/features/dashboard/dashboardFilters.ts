import type { PackageStatus, TrailerStatus } from '@logistics/shared-types';

export interface DashboardFilters {
  fromDate: string;
  toDate: string;
  terminalId: string;
  packageStatus: '' | PackageStatus;
  trailerStatus: '' | TrailerStatus;
}

export interface DashboardQuery {
  fromDate?: string;
  toDate?: string;
  terminalId?: number;
  packageStatus?: PackageStatus;
  trailerStatus?: TrailerStatus;
}

export const emptyDashboardFilters: DashboardFilters = {
  fromDate: '',
  toDate: '',
  terminalId: '',
  packageStatus: '',
  trailerStatus: '',
};

/** Removes blank controls and converts the terminal selection for the API. */
export const toDashboardQuery = (filters: DashboardFilters): DashboardQuery => ({
  ...(filters.fromDate && { fromDate: filters.fromDate }),
  ...(filters.toDate && { toDate: filters.toDate }),
  ...(filters.terminalId && { terminalId: Number(filters.terminalId) }),
  ...(filters.packageStatus && { packageStatus: filters.packageStatus }),
  ...(filters.trailerStatus && { trailerStatus: filters.trailerStatus }),
});
