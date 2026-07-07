import type { SearchResultDto } from '@logistics/shared-types';
import { apiClient } from './apiClient';

export const searchApi = {
  // Encoding keeps scanned identifiers safe when they contain URL-reserved characters.
  findByBarcode: async (barcode: string) =>
    (await apiClient.get<SearchResultDto>(`/search/${encodeURIComponent(barcode)}`)).data,
};
