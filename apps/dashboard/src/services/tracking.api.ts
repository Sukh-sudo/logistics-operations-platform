import type { ShipmentTrackingDto } from '@logistics/shared-types';

import { apiClient } from './apiClient';

export const trackingApi = {
  shipment: async (shipmentNumber: string) =>
    (
      await apiClient.get<ShipmentTrackingDto>(
        `/tracking/${encodeURIComponent(shipmentNumber)}`,
      )
    ).data,
};
