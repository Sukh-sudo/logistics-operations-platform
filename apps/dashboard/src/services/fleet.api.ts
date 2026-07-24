import type { AssignEquipmentDto, DriverDto, EquipmentAssignmentDto, FleetAvailabilityDto, TruckDto } from '@logistics/shared-types';
import { apiClient } from './apiClient';

const read = async <T>(path: string) => (await apiClient.get<T>(path)).data;

// Fleet reads intentionally consume snapshots returned by the backend.
export const fleetApi = {
  trucks: () => read<TruckDto[]>('/fleet/trucks'),
  truck: (id: string) => read<TruckDto>(`/fleet/trucks/${encodeURIComponent(id)}`),
  drivers: () => read<DriverDto[]>('/fleet/drivers'),
  driver: (id: string) => read<DriverDto>(`/fleet/drivers/${encodeURIComponent(id)}`),
  assignments: () => read<EquipmentAssignmentDto[]>('/fleet/assignments'),
  assign: async (payload: AssignEquipmentDto) => (await apiClient.post<EquipmentAssignmentDto>('/fleet/assignments', payload)).data,
  release: async (id: string) => (await apiClient.post<EquipmentAssignmentDto>(`/fleet/assignments/${encodeURIComponent(id)}/release`)).data,
  availability: (terminalId?: number) => read<FleetAvailabilityDto>(`/fleet/availability${terminalId ? `?terminalId=${terminalId}` : ''}`),
};
