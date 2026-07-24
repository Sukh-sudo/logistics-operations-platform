import type { ContainerEventDto, ContainerPackageActionDto, ContainerSnapshotDto, CreateContainerDto, PackageSnapshotDto } from '@logistics/shared-types';
import { apiClient } from './apiClient';

export interface ContainerPackagesDto {
  containerBarcode: string;
  packageCount: number;
  packages: PackageSnapshotDto[];
}

const containerPath = (containerBarcode: string) => `/containers/${encodeURIComponent(containerBarcode)}`;

export const containerApi = {
  create: async (payload: CreateContainerDto) => (await apiClient.post<ContainerSnapshotDto>('/containers', payload)).data,
  loadPackage: async (containerId: string, payload: ContainerPackageActionDto) => (await apiClient.post(`${containerPath(containerId)}/load-package`, payload)).data,
  unloadPackage: async (containerId: string, payload: ContainerPackageActionDto) => (await apiClient.post(`${containerPath(containerId)}/unload-package`, payload)).data,
  snapshot: async (containerBarcode: string) => (await apiClient.get<ContainerSnapshotDto>(containerPath(containerBarcode))).data,
  packages: async (containerBarcode: string) => (await apiClient.get<ContainerPackagesDto>(`${containerPath(containerBarcode)}/packages`)).data,
  history: async (containerBarcode: string) => (await apiClient.get<ContainerEventDto[]>(`${containerPath(containerBarcode)}/history`)).data,
};
