import type { DriverDto, EquipmentAssignmentDto, TruckDto } from '@logistics/shared-types';
import { apiClient } from './apiClient';

const read = async <T>(path: string) => (await apiClient.get<T>(path)).data;

// Fleet reads intentionally consume snapshots returned by the backend.
export const fleetApi = {
  trucks: () => read<TruckDto[]>('/fleet/trucks'),
  drivers: () => read<DriverDto[]>('/fleet/drivers'),
  assignments: () => read<EquipmentAssignmentDto[]>('/fleet/assignments'),
};
