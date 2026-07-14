import type { RouteDetailDto } from '@logistics/shared-types';
import { apiClient } from './apiClient';

export const routeApi = {
  detail: async (id: string) => (await apiClient.get<RouteDetailDto>(`/routes/${encodeURIComponent(id)}`)).data,
};
