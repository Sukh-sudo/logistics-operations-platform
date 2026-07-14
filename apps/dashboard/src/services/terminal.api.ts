import type { TerminalDto, TerminalEventDto, TerminalInventoryDto, TerminalOperationsDto } from '@logistics/shared-types';
import { apiClient } from './apiClient';

const path = (id: number) => `/terminals/${id}`;
export const terminalApi = {
  detail: async (id: number) => (await apiClient.get<TerminalDto>(path(id))).data,
  inventory: async (id: number) => (await apiClient.get<TerminalInventoryDto>(`${path(id)}/inventory`)).data,
  operations: async (id: number) => (await apiClient.get<TerminalOperationsDto>(`${path(id)}/operations`)).data,
  history: async (id: number) => (await apiClient.get<TerminalEventDto[]>(`${path(id)}/history`)).data,
};
