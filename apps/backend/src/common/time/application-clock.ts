import { Injectable } from '@nestjs/common';
import { AsyncLocalStorage } from 'node:async_hooks';

/**
 * Supplies wall-clock time to the application while allowing offline jobs,
 * such as the demo-data generator, to run a complete workflow at a simulated
 * instant. AsyncLocalStorage keeps the override scoped to the workflow instead
 * of changing time globally for concurrent requests.
 */
@Injectable()
export class ApplicationClock {
  private readonly scenarioTime = new AsyncLocalStorage<Date>();

  now(): Date {
    const instant = this.scenarioTime.getStore();
    return instant ? new Date(instant.getTime()) : new Date();
  }

  scenarioNow(): Date | undefined {
    const instant = this.scenarioTime.getStore();
    return instant ? new Date(instant.getTime()) : undefined;
  }

  runAt<T>(instant: Date | string, operation: () => T): T {
    if (
      typeof instant === 'string' &&
      !/(?:Z|[+-]\d{2}:\d{2})$/i.test(instant)
    ) {
      throw new RangeError('Scenario time strings must include a UTC offset');
    }
    const parsed = instant instanceof Date ? new Date(instant.getTime()) : new Date(instant);
    if (Number.isNaN(parsed.getTime())) {
      throw new RangeError('Scenario time must be a valid date');
    }

    return this.scenarioTime.run(parsed, operation);
  }
}
