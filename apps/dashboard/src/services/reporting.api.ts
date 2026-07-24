import type {
  DeliveryReportDto,
  DeliveryReportFilters,
} from '@logistics/shared-types';

import { apiClient } from './apiClient';

export const reportingApi = {
  deliveries: async (filters: DeliveryReportFilters = {}) =>
    (
      await apiClient.get<DeliveryReportDto>('/reports/deliveries', {
        params: filters,
      })
    ).data,
};
