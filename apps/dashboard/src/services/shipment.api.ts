import type { PackageSnapshotDto, ShipmentDetailDto, ShipmentEventDto } from '@logistics/shared-types';
import { apiClient } from './apiClient';

const path = (id: string) => `/shipments/${encodeURIComponent(id)}`;
export const shipmentApi = {
  detail: async (id: string) => (await apiClient.get<ShipmentDetailDto>(path(id))).data,
  packages: async (id: string) => (await apiClient.get<PackageSnapshotDto[]>(`${path(id)}/packages`)).data,
  history: async (id: string) => (await apiClient.get<ShipmentEventDto[]>(`${path(id)}/history`)).data,
};
