import type { CreateShipmentDto, PackageSnapshotDto, ShipmentDetailDto, ShipmentEventDto, ShipmentPackageActionDto, UpdateShipmentDto } from '@logistics/shared-types';
import { apiClient } from './apiClient';

const path = (id: string) => `/shipments/${encodeURIComponent(id)}`;
export const shipmentApi = {
  create: async (payload: CreateShipmentDto) => (await apiClient.post<ShipmentDetailDto>('/shipments', payload)).data,
  update: async (id: string, payload: UpdateShipmentDto) => (await apiClient.patch<ShipmentDetailDto>(path(id), payload)).data,
  assignPackage: async (id: string, payload: ShipmentPackageActionDto) => (await apiClient.post(`${path(id)}/assign-package`, payload)).data,
  removePackage: async (id: string, payload: ShipmentPackageActionDto) => (await apiClient.post(`${path(id)}/remove-package`, payload)).data,
  complete: async (id: string) => (await apiClient.post(`${path(id)}/complete`)).data,
  cancel: async (id: string) => (await apiClient.post(`${path(id)}/cancel`)).data,
  detail: async (id: string) => (await apiClient.get<ShipmentDetailDto>(path(id))).data,
  packages: async (id: string) => (await apiClient.get<PackageSnapshotDto[]>(`${path(id)}/packages`)).data,
  history: async (id: string) => (await apiClient.get<ShipmentEventDto[]>(`${path(id)}/history`)).data,
};
