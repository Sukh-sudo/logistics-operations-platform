import type { DashboardContainerDto, DashboardPackageDto, DashboardSummaryDto, DashboardTerminalOptionDto, DashboardTrailerDto, HandheldKpiDto, RecentEventDto, TerminalPerformanceDto } from '@logistics/shared-types';
import type { DashboardQuery } from '../features/dashboard/dashboardFilters';
import type { PackageListQuery } from '../features/packages/packageListFilters';
import type { ContainerStatus, TrailerStatus } from '@logistics/shared-types';
import type { AssetLaneQuery } from '../features/assets/assetLaneFilters';
import { apiClient } from './apiClient';

const read = async <T, P = DashboardQuery>(path: string, params?: P) =>
  (await apiClient.get<T>(path, { params })).data;
export const dashboardApi = {
  summary: (params?: DashboardQuery) => read<DashboardSummaryDto>('/dashboard/summary', params),
  events: (params?: DashboardQuery) => read<RecentEventDto[]>('/dashboard/recent-events', params),
  terminals: () => read<DashboardTerminalOptionDto[]>('/terminals'),
  terminalPerformance: (params?: Pick<DashboardQuery, 'fromDate' | 'toDate' | 'terminalId'>) =>
    read<TerminalPerformanceDto[], Pick<DashboardQuery, 'fromDate' | 'toDate' | 'terminalId'>>('/terminals/performance', params),
  packages: (params?: PackageListQuery) => read<DashboardPackageDto[], PackageListQuery>('/dashboard/packages', params),
  containers: (params?: AssetLaneQuery<ContainerStatus>) => read<DashboardContainerDto[], AssetLaneQuery<ContainerStatus>>('/dashboard/containers', params),
  trailers: (params?: AssetLaneQuery<TrailerStatus>) => read<DashboardTrailerDto[], AssetLaneQuery<TrailerStatus>>('/dashboard/trailers', params),
  handheldKpis: (params?: { terminalId?: number; from?: string; to?: string }) =>
    read<HandheldKpiDto>('/dashboard/terminal-kpis/handheld', params),
};
