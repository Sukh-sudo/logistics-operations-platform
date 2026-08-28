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
export const useTerminalPerformance = (filters: DashboardFilters = emptyDashboardFilters) => {
  const query = toDashboardQuery(filters);
  const params = {
    ...(query.fromDate && { fromDate: query.fromDate }),
    ...(query.toDate && { toDate: query.toDate }),
    ...(query.terminalId && { terminalId: query.terminalId }),
  };
  return useQuery({ queryKey: ['dashboard', 'terminal-performance', params], queryFn: () => dashboardApi.terminalPerformance(params), placeholderData: keepPreviousData });
};
export const useHandheldKpis = (filters: DashboardFilters = emptyDashboardFilters) => {
  const params = {
    ...(filters.terminalId && { terminalId: Number(filters.terminalId) }),
    ...(filters.fromDate && { from: `${filters.fromDate}T00:00:00.000Z` }),
    ...(filters.toDate && { to: `${filters.toDate}T23:59:59.999Z` }),
  };
  return useQuery({ queryKey: ['dashboard', 'handheld-kpis', params], queryFn: () => dashboardApi.handheldKpis(params), placeholderData: keepPreviousData });
};
export const useOperationalAssets = () => useQuery({ queryKey: ['dashboard', 'assets'], queryFn: async () => { const [packages, containers, trailers] = await Promise.all([dashboardApi.packages(), dashboardApi.containers(), dashboardApi.trailers()]); return { packages, containers, trailers }; } });
