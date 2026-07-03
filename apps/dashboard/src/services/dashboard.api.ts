import type { DashboardContainerDto, DashboardPackageDto, DashboardSummaryDto, DashboardTrailerDto, RecentEventDto } from '@logistics/shared-types';
import { apiClient } from './apiClient';

const read = async <T>(path: string) => (await apiClient.get<T>(path)).data;
export const dashboardApi = {
  summary: () => read<DashboardSummaryDto>('/dashboard/summary'),
  events: () => read<RecentEventDto[]>('/dashboard/recent-events'),
  packages: () => read<DashboardPackageDto[]>('/dashboard/packages'),
  containers: () => read<DashboardContainerDto[]>('/dashboard/containers'),
  trailers: () => read<DashboardTrailerDto[]>('/dashboard/trailers'),
};
