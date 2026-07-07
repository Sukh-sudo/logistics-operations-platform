import type { PackageEventDto, PackageLocationDto, PackageSnapshotDto } from '@logistics/shared-types';
import { apiClient } from './apiClient';

const packagePath = (trackingNumber: string) => `/package-events/${encodeURIComponent(trackingNumber)}`;

export const packageApi = {
  snapshot: async (trackingNumber: string) => (await apiClient.get<PackageSnapshotDto>(packagePath(trackingNumber))).data,
  location: async (trackingNumber: string) => (await apiClient.get<PackageLocationDto>(`${packagePath(trackingNumber)}/location`)).data,
  history: async (trackingNumber: string) => (await apiClient.get<PackageEventDto[]>(`${packagePath(trackingNumber)}/history`)).data,
};
