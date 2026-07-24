import type { TripDetailDto, TripStopActionDto } from '@logistics/shared-types';
import { apiClient } from './apiClient';

export const tripApi = {
  detail: async (id: string) => (await apiClient.get<TripDetailDto>(`/trips/${encodeURIComponent(id)}`)).data,
  start: async (id: string) => (await apiClient.post(`/trips/${encodeURIComponent(id)}/start`)).data,
  arrive: async (id: string, stopId: string, payload: TripStopActionDto) => (await apiClient.post(`/trips/${encodeURIComponent(id)}/stops/${encodeURIComponent(stopId)}/arrive`, payload)).data,
  depart: async (id: string, stopId: string, payload: TripStopActionDto) => (await apiClient.post(`/trips/${encodeURIComponent(id)}/stops/${encodeURIComponent(stopId)}/depart`, payload)).data,
  complete: async (id: string) => (await apiClient.post(`/trips/${encodeURIComponent(id)}/complete`)).data,
  cancel: async (id: string) => (await apiClient.post(`/trips/${encodeURIComponent(id)}/cancel`)).data,
};
