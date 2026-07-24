import type { HealthStatusDto, LivenessStatusDto, ReadinessStatusDto } from '@logistics/shared-types';
import { apiClient } from './apiClient';

export const healthApi = {
  status: async () => (await apiClient.get<HealthStatusDto>('/health')).data,
  live: async () => (await apiClient.get<LivenessStatusDto>('/health/live')).data,
  ready: async () => (await apiClient.get<ReadinessStatusDto>('/health/ready')).data,
};
