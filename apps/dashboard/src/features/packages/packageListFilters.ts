import type { PackageStatus } from '@logistics/shared-types';

export interface PackageListFilters {
  fromDate: string;
  toDate: string;
  originTerminalId: string;
  destinationTerminalId: string;
  status: PackageStatus | '';
}

export interface PackageListQuery {
  fromDate?: string;
  toDate?: string;
  originTerminalId?: number;
  destinationTerminalId?: number;
  status?: PackageStatus;
}

export const emptyPackageListFilters: PackageListFilters = {
  fromDate: '',
  toDate: '',
  originTerminalId: '',
  destinationTerminalId: '',
  status: '',
};

export const toPackageListQuery = (filters: PackageListFilters): PackageListQuery => ({
  ...(filters.fromDate && { fromDate: filters.fromDate }),
  ...(filters.toDate && { toDate: filters.toDate }),
  ...(filters.originTerminalId && { originTerminalId: Number(filters.originTerminalId) }),
  ...(filters.destinationTerminalId && { destinationTerminalId: Number(filters.destinationTerminalId) }),
  ...(filters.status && { status: filters.status }),
});
