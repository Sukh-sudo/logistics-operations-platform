import type { TerminalDto, TerminalEmployeeDto, TerminalEventDto, TerminalInventoryDto, TerminalMovementDto, TerminalOperationsDto, TerminalPerformanceDto, TransferTerminalAssetDto } from '@logistics/shared-types';
import { apiClient } from './apiClient';

const path = (id: number) => `/terminals/${id}`;
export const terminalApi = {
  detail: async (id: number) => (await apiClient.get<TerminalDto>(path(id))).data,
  inventory: async (id: number) => (await apiClient.get<TerminalInventoryDto>(`${path(id)}/inventory`)).data,
  operations: async (id: number) => (await apiClient.get<TerminalOperationsDto>(`${path(id)}/operations`)).data,
  employees: async (id: number) => (await apiClient.get<TerminalEmployeeDto[]>(`${path(id)}/employees`)).data,
  movements: async (id: number, params?: { fromDate?: string; toDate?: string }) => (await apiClient.get<TerminalMovementDto[]>(`${path(id)}/movements`, { params })).data,
  performance: async (id: number, params?: { fromDate?: string; toDate?: string }) => (await apiClient.get<TerminalPerformanceDto[]>('/terminals/performance', { params: { ...params, terminalId: id } })).data[0],
  history: async (id: number) => (await apiClient.get<TerminalEventDto[]>(`${path(id)}/history`)).data,
  transfer: async (id: number, payload: TransferTerminalAssetDto) => (await apiClient.post(`${path(id)}/transfer`, payload)).data,
};
