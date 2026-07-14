import { describe, expect, it } from 'vitest';
import { clampProgress, tripStopTiming } from './tripProgress';

describe('trip progress display', () => {
  it('prefers actual stop timestamps and bounds progress', () => {
    const timing = tripStopTiming({ plannedArrival: 'planned-a', actualArrival: 'actual-a', plannedDeparture: 'planned-d', actualDeparture: null } as never);
    expect(timing).toMatchObject({ arrival: 'actual-a', departure: 'planned-d', arrivalActual: true, departureActual: false });
    expect(clampProgress(120)).toBe(100);
  });
});
