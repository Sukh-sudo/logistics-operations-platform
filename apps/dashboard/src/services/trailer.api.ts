import type { TrailerContainersDto, TrailerEventDto, TrailerPackagesDto, TrailerSnapshotDto } from '@logistics/shared-types';
import { apiClient } from './apiClient';

const path = (barcode: string) => `/trailers/${encodeURIComponent(barcode)}`;
export const trailerApi = {
  snapshot: async (barcode: string) => (await apiClient.get<TrailerSnapshotDto>(path(barcode))).data,
  containers: async (barcode: string) => (await apiClient.get<TrailerContainersDto>(`${path(barcode)}/containers`)).data,
  packages: async (barcode: string) => (await apiClient.get<TrailerPackagesDto>(`${path(barcode)}/packages`)).data,
  history: async (barcode: string) => (await apiClient.get<TrailerEventDto[]>(`${path(barcode)}/history`)).data,
};
