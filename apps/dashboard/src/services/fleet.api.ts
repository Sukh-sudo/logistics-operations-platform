import type { DriverDto, EquipmentAssignmentDto, FleetAvailabilityDto, TruckDto } from '@logistics/shared-types';
import { apiClient } from './apiClient';

const read = async <T>(path: string) => (await apiClient.get<T>(path)).data;

// Fleet reads intentionally consume snapshots returned by the backend.
export const fleetApi = {
  trucks: () => read<TruckDto[]>('/fleet/trucks'),
  truck: (id: string) => read<TruckDto>(`/fleet/trucks/${encodeURIComponent(id)}`),
  drivers: () => read<DriverDto[]>('/fleet/drivers'),
  driver: (id: string) => read<DriverDto>(`/fleet/drivers/${encodeURIComponent(id)}`),
  assignments: () => read<EquipmentAssignmentDto[]>('/fleet/assignments'),
  availability: (terminalId?: number) => read<FleetAvailabilityDto>(`/fleet/availability${terminalId ? `?terminalId=${terminalId}` : ''}`),
};
