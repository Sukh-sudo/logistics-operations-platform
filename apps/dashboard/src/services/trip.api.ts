import type { TripDetailDto } from '@logistics/shared-types';
import { apiClient } from './apiClient';

export const tripApi = {
  detail: async (id: string) => (await apiClient.get<TripDetailDto>(`/trips/${encodeURIComponent(id)}`)).data,
};
