import type { SearchResultDto } from '@logistics/shared-types';

export interface SearchResultView {
  identifier: string;
  detailPath: string;
  status: string;
  typeLabel: string;
  facts: Array<{ label: string; value: string }>;
}

const valueOrDash = (value: string | number | null | undefined) => value == null ? '—' : String(value);

// Keep result-specific field selection outside the page so every asset card stays consistent.
export function toSearchResultView(result: SearchResultDto): SearchResultView {
  if (result.type === 'PACKAGE') return {
    identifier: result.data.trackingNumber,
    detailPath: `/packages/${encodeURIComponent(result.data.trackingNumber)}`,
    status: result.data.currentStatus,
    typeLabel: 'Package',
    facts: [
      { label: 'Package type', value: result.data.packageType.replaceAll('_', ' ') },
      { label: 'Terminal', value: valueOrDash(result.data.currentTerminalId) },
      { label: 'Container', value: valueOrDash(result.data.currentContainerId) },
      { label: 'Trailer', value: valueOrDash(result.data.currentTrailerId) },
    ],
  };

  if (result.type === 'CONTAINER') return {
    identifier: result.data.containerBarcode,
    detailPath: `/containers/${encodeURIComponent(result.data.containerBarcode)}`,
    status: result.data.currentStatus,
    typeLabel: 'Container',
    facts: [
      { label: 'Package type', value: result.data.packageType.replaceAll('_', ' ') },
      { label: 'Packages', value: String(result.data.packageCount) },
      { label: 'Terminal', value: valueOrDash(result.data.currentTerminalId) },
      { label: 'Trailer', value: valueOrDash(result.data.currentTrailerId) },
    ],
  };

  return {
    identifier: result.data.trailerBarcode,
    detailPath: `/trailers/${encodeURIComponent(result.data.trailerBarcode)}`,
    status: result.data.currentStatus,
    typeLabel: 'Trailer',
    facts: [
      { label: 'Containers', value: String(result.data.containerCount) },
      { label: 'Packages', value: String(result.data.packageCount) },
      { label: 'Terminal', value: valueOrDash(result.data.currentTerminalId) },
    ],
  };
}
