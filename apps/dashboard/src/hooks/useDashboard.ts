import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { emptyDashboardFilters, toDashboardQuery, type DashboardFilters } from '../features/dashboard/dashboardFilters';
import { dashboardApi } from '../services/dashboard.api';
export const useDashboardSummary = (filters: DashboardFilters = emptyDashboardFilters) => {
  const query = toDashboardQuery(filters);
  return useQuery({ queryKey: ['dashboard', 'summary', query], queryFn: () => dashboardApi.summary(query), placeholderData: keepPreviousData });
};
export const useRecentEvents = (filters: DashboardFilters = emptyDashboardFilters) => {
  const query = toDashboardQuery(filters);
  return useQuery({ queryKey: ['dashboard', 'events', query], queryFn: () => dashboardApi.events(query), placeholderData: keepPreviousData });
};
export const useDashboardTerminals = () => useQuery({ queryKey: ['dashboard', 'terminals'], queryFn: dashboardApi.terminals });
export const useOperationalAssets = () => useQuery({ queryKey: ['dashboard', 'assets'], queryFn: async () => { const [packages, containers, trailers] = await Promise.all([dashboardApi.packages(), dashboardApi.containers(), dashboardApi.trailers()]); return { packages, containers, trailers }; } });
