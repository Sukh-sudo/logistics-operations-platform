import type { AssignEquipmentDto, DashboardTerminalOptionDto, DriverDto, DriverStatus, EquipmentAssignmentDto, EquipmentAssignmentStatus, FleetAvailabilityDto, TruckDto, TruckStatus } from '@logistics/shared-types';
import type { FleetListQuery } from '../features/fleet/fleetFilters';
import { apiClient } from './apiClient';

const read = async <T, P = never>(path: string, params?: P) => (await apiClient.get<T>(path, { params })).data;

// Fleet reads intentionally consume snapshots returned by the backend.
export const fleetApi = {
  trucks: (params?: FleetListQuery<TruckStatus>) => read<TruckDto[], FleetListQuery<TruckStatus>>('/fleet/trucks', params),
  truck: (id: string) => read<TruckDto>(`/fleet/trucks/${encodeURIComponent(id)}`),
  drivers: (params?: FleetListQuery<DriverStatus>) => read<DriverDto[], FleetListQuery<DriverStatus>>('/fleet/drivers', params),
  driver: (id: string) => read<DriverDto>(`/fleet/drivers/${encodeURIComponent(id)}`),
  assignments: (params?: FleetListQuery<EquipmentAssignmentStatus>) => read<EquipmentAssignmentDto[], FleetListQuery<EquipmentAssignmentStatus>>('/fleet/assignments', params),
  terminals: () => read<DashboardTerminalOptionDto[]>('/terminals'),
  assign: async (payload: AssignEquipmentDto) => (await apiClient.post<EquipmentAssignmentDto>('/fleet/assignments', payload)).data,
  release: async (id: string) => (await apiClient.post<EquipmentAssignmentDto>(`/fleet/assignments/${encodeURIComponent(id)}/release`)).data,
  availability: (terminalId?: number) => read<FleetAvailabilityDto>(`/fleet/availability${terminalId ? `?terminalId=${terminalId}` : ''}`),
};
