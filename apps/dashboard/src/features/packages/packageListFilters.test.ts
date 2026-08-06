import { describe, expect, it } from 'vitest';
import { emptyPackageListFilters, toPackageListQuery } from './packageListFilters';

describe('package list filters', () => {
  it('omits empty values from the API query', () => {
    expect(toPackageListQuery(emptyPackageListFilters)).toEqual({});
  });

  it('normalizes terminal identifiers to numbers', () => {
    expect(toPackageListQuery({
      fromDate: '2026-07-01',
      toDate: '2026-07-31',
      originTerminalId: '1',
      destinationTerminalId: '2',
      status: 'IN_TRAILER',
    })).toEqual({
      fromDate: '2026-07-01',
      toDate: '2026-07-31',
      originTerminalId: 1,
      destinationTerminalId: 2,
      status: 'IN_TRAILER',
    });
  });
});
