import { useQuery } from '@tanstack/react-query';
import { dashboardApi } from '../services/dashboard.api';
export const useDashboardSummary = () => useQuery({ queryKey: ['dashboard', 'summary'], queryFn: dashboardApi.summary });
export const useRecentEvents = () => useQuery({ queryKey: ['dashboard', 'events'], queryFn: dashboardApi.events });
export const useOperationalAssets = () => useQuery({ queryKey: ['dashboard', 'assets'], queryFn: async () => { const [packages, containers, trailers] = await Promise.all([dashboardApi.packages(), dashboardApi.containers(), dashboardApi.trailers()]); return { packages, containers, trailers }; } });
