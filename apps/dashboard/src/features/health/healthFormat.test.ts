import { describe, expect, it } from 'vitest';
import { formatUptime, isHealthyStatus } from './healthFormat';

describe('health formatting', () => {
  it('formats uptime and classifies service states', () => {
    expect(formatUptime(90061)).toBe('1d 1h 1m');
    expect(isHealthyStatus('connected')).toBe(true);
    expect(isHealthyStatus('unavailable')).toBe(false);
  });
});
