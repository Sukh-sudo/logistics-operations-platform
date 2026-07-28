import type { DashboardContainerDto, DashboardPackageDto, DashboardSummaryDto, DashboardTerminalOptionDto, DashboardTrailerDto, HandheldKpiDto, RecentEventDto } from '@logistics/shared-types';
import type { DashboardQuery } from '../features/dashboard/dashboardFilters';
import { apiClient } from './apiClient';

const read = async <T, P = DashboardQuery>(path: string, params?: P) =>
  (await apiClient.get<T>(path, { params })).data;
export const dashboardApi = {
  summary: (params?: DashboardQuery) => read<DashboardSummaryDto>('/dashboard/summary', params),
  events: (params?: DashboardQuery) => read<RecentEventDto[]>('/dashboard/recent-events', params),
  terminals: () => read<DashboardTerminalOptionDto[]>('/terminals'),
  packages: () => read<DashboardPackageDto[]>('/dashboard/packages'),
  containers: () => read<DashboardContainerDto[]>('/dashboard/containers'),
  trailers: () => read<DashboardTrailerDto[]>('/dashboard/trailers'),
  handheldKpis: (params?: { terminalId?: number; from?: string; to?: string }) =>
    read<HandheldKpiDto>('/dashboard/terminal-kpis/handheld', params),
};
