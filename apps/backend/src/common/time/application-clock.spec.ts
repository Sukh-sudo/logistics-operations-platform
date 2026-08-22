import { ApplicationClock } from './application-clock';

describe('ApplicationClock', () => {
  const clock = new ApplicationClock();

  it('uses wall-clock time when no scenario is active', () => {
    const before = Date.now();
    const actual = clock.now().getTime();
    const after = Date.now();

    expect(actual).toBeGreaterThanOrEqual(before);
    expect(actual).toBeLessThanOrEqual(after);
    expect(clock.scenarioNow()).toBeUndefined();
  });

  it('keeps simulated time across asynchronous workflow calls', async () => {
    const instant = new Date('2026-07-10T14:30:00.000Z');

    const actual = await clock.runAt(instant, async () => {
      await Promise.resolve();
      return clock.now();
    });

    expect(actual).toEqual(instant);
    expect(actual).not.toBe(instant);
    expect(clock.scenarioNow()).toBeUndefined();
  });

  it('isolates concurrent scenario times', async () => {
    const first = new Date('2026-07-01T10:00:00.000Z');
    const second = new Date('2026-08-01T10:00:00.000Z');

    const [firstResult, secondResult] = await Promise.all([
      clock.runAt(first, async () => {
        await Promise.resolve();
        return clock.now();
      }),
      clock.runAt(second, async () => {
        await Promise.resolve();
        return clock.now();
      }),
    ]);

    expect(firstResult).toEqual(first);
    expect(secondResult).toEqual(second);
  });

  it('rejects invalid scenario dates', () => {
    expect(() => clock.runAt('not-a-date', () => undefined)).toThrow(
      'Scenario time strings must include a UTC offset',
    );
    expect(() =>
      clock.runAt('2026-07-10T14:30:00', () => undefined),
    ).toThrow('Scenario time strings must include a UTC offset');
    expect(() =>
      clock.runAt('2026-99-99T14:30:00.000Z', () => undefined),
    ).toThrow('Scenario time must be a valid date');
  });
});
