import { describe, expect, it } from 'vitest';
import { emptyDashboardFilters, toDashboardQuery } from './dashboardFilters';

describe('dashboard filters', () => {
  it('omits blank controls from an unfiltered API query', () => {
    expect(toDashboardQuery(emptyDashboardFilters)).toEqual({});
  });

  it('serializes the combined filter values for the dashboard API', () => {
    expect(toDashboardQuery({
      fromDate: '2026-07-01',
      toDate: '2026-07-22',
      terminalId: '12',
      packageStatus: 'OUT_FOR_DELIVERY',
      trailerStatus: 'IN_TRANSIT',
    })).toEqual({
      fromDate: '2026-07-01',
      toDate: '2026-07-22',
      terminalId: 12,
      packageStatus: 'OUT_FOR_DELIVERY',
      trailerStatus: 'IN_TRANSIT',
    });
  });
});
