import type { SearchResultDto } from '@logistics/shared-types';
import { apiClient } from './apiClient';

export const searchApi = {
  // The query route is the canonical search contract; Axios safely encodes it.
  findByBarcode: async (barcode: string) =>
    (await apiClient.get<SearchResultDto>('/search', { params: { q: barcode } })).data,
};
