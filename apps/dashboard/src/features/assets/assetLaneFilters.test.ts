import { describe, expect, it } from 'vitest';
import { emptyAssetLaneFilters, toAssetLaneQuery } from './assetLaneFilters';

describe('asset lane filters', () => {
  it('omits empty values', () => {
    expect(toAssetLaneQuery(emptyAssetLaneFilters())).toEqual({});
  });

  it('normalizes terminal identifiers', () => {
    expect(toAssetLaneQuery({
      fromDate: '2026-07-01',
      toDate: '2026-07-31',
      originTerminalId: '1',
      destinationTerminalId: '2',
      status: 'OPEN',
    })).toEqual({
      fromDate: '2026-07-01',
      toDate: '2026-07-31',
      originTerminalId: 1,
      destinationTerminalId: 2,
      status: 'OPEN',
    });
  });
});
