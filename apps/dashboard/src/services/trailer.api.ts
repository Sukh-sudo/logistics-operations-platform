import type { CreateTrailerDto, TrailerContainerActionDto, TrailerContainersDto, TrailerEventDto, TrailerPackageActionDto, TrailerPackagesDto, TrailerSnapshotDto } from '@logistics/shared-types';
import { apiClient } from './apiClient';

const path = (barcode: string) => `/trailers/${encodeURIComponent(barcode)}`;
export const trailerApi = {
  create: async (payload: CreateTrailerDto) => (await apiClient.post<TrailerSnapshotDto>('/trailers', payload)).data,
  loadContainer: async (id: string, payload: TrailerContainerActionDto) => (await apiClient.post(`${path(id)}/load-container`, payload)).data,
  unloadContainer: async (id: string, payload: TrailerContainerActionDto) => (await apiClient.post(`${path(id)}/unload-container`, payload)).data,
  loadPackage: async (id: string, payload: TrailerPackageActionDto) => (await apiClient.post(`${path(id)}/load-package`, payload)).data,
  unloadPackage: async (id: string, payload: TrailerPackageActionDto) => (await apiClient.post(`${path(id)}/unload-package`, payload)).data,
  snapshot: async (barcode: string) => (await apiClient.get<TrailerSnapshotDto>(path(barcode))).data,
  containers: async (barcode: string) => (await apiClient.get<TrailerContainersDto>(`${path(barcode)}/containers`)).data,
  packages: async (barcode: string) => (await apiClient.get<TrailerPackagesDto>(`${path(barcode)}/packages`)).data,
  history: async (barcode: string) => (await apiClient.get<TrailerEventDto[]>(`${path(barcode)}/history`)).data,
};
