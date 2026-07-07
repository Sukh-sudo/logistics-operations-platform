import type { SearchResultDto } from '@logistics/shared-types';
import { describe, expect, it } from 'vitest';
import { toSearchResultView } from './searchResult';

describe('toSearchResultView', () => {
  it('maps a package snapshot to its detail route and operational facts', () => {
    const result: SearchResultDto = { type: 'PACKAGE', data: { id: 'pkg-1', trackingNumber: 'PKG/100', packageType: 'DANGEROUS_GOODS', currentStatus: 'IN_CONTAINER', currentTerminalId: 1, currentContainerId: 'container-1', currentTrailerId: null, updatedAt: '2026-07-07T12:00:00Z' } };
    const view = toSearchResultView(result);
    expect(view.detailPath).toBe('/packages/PKG%2F100');
    expect(view.facts).toContainEqual({ label: 'Package type', value: 'DANGEROUS GOODS' });
    expect(view.facts).toContainEqual({ label: 'Trailer', value: '—' });
  });

  it('maps container and trailer counts from their snapshots', () => {
    const container = toSearchResultView({ type: 'CONTAINER', data: { id: 'c-1', containerBarcode: 'C-1', packageType: 'MAIL', currentStatus: 'OPEN', currentTrailerId: null, currentTerminalId: 2, packageCount: 4, updatedAt: '2026-07-07T12:00:00Z' } });
    const trailer = toSearchResultView({ type: 'TRAILER', data: { id: 't-1', trailerBarcode: 'T-1', currentStatus: 'IN_TRANSIT', currentTerminalId: null, containerCount: 3, packageCount: 12, updatedAt: '2026-07-07T12:00:00Z' } });
    expect(container.facts).toContainEqual({ label: 'Packages', value: '4' });
    expect(trailer.facts).toContainEqual({ label: 'Containers', value: '3' });
  });
});
