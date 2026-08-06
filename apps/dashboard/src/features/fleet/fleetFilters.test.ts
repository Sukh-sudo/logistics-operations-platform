import { describe, expect, it } from 'vitest';
import { emptyFleetFilters, toFleetListQuery } from './fleetFilters';

describe('fleet filters', () => {
  it('omits empty values', () => {
    expect(toFleetListQuery(emptyFleetFilters, ['AVAILABLE'])).toEqual({});
  });

  it('normalizes the terminal and accepts only statuses for the active tab', () => {
    const filters = { terminalId: '7', status: 'MAINTENANCE' };
    expect(toFleetListQuery(filters, ['AVAILABLE', 'MAINTENANCE'])).toEqual({ terminalId: 7, status: 'MAINTENANCE' });
    expect(toFleetListQuery(filters, ['ACTIVE', 'RELEASED'])).toEqual({ terminalId: 7 });
  });
});
