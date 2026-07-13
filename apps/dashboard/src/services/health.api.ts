import type { HealthStatusDto } from '@logistics/shared-types';
import { apiClient } from './apiClient';

export const healthApi = {
  status: async () => (await apiClient.get<HealthStatusDto>('/health')).data,
};
