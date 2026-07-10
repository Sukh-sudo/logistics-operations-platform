import type { ContainerEventDto, ContainerSnapshotDto, PackageSnapshotDto } from '@logistics/shared-types';
import { apiClient } from './apiClient';

export interface ContainerPackagesDto {
  containerBarcode: string;
  packageCount: number;
  packages: PackageSnapshotDto[];
}

const containerPath = (containerBarcode: string) => `/containers/${encodeURIComponent(containerBarcode)}`;

export const containerApi = {
  snapshot: async (containerBarcode: string) => (await apiClient.get<ContainerSnapshotDto>(containerPath(containerBarcode))).data,
  packages: async (containerBarcode: string) => (await apiClient.get<ContainerPackagesDto>(`${containerPath(containerBarcode)}/packages`)).data,
  history: async (containerBarcode: string) => (await apiClient.get<ContainerEventDto[]>(`${containerPath(containerBarcode)}/history`)).data,
};
