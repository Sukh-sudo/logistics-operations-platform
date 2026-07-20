import { describe, expect, it } from 'vitest';
import { filterAssets } from './assetFilter';

const assets = [
  { barcode: 'PKG000000001', status: 'IN_CONTAINER', location: 'CONT000001' },
  { barcode: 'PKG000000002', status: 'DELIVERED', location: null },
];

describe('filterAssets', () => {
  it('matches identifiers, statuses, and locations without case sensitivity', () => {
    const values = (asset: (typeof assets)[number]) => [asset.barcode, asset.status, asset.location];

    expect(filterAssets(assets, 'cont000001', values)).toEqual([assets[0]]);
    expect(filterAssets(assets, 'delivered', values)).toEqual([assets[1]]);
  });

  it('returns every snapshot when the query only contains whitespace', () => {
    expect(filterAssets(assets, '   ', (asset) => [asset.barcode])).toEqual(assets);
  });
});
