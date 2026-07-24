import { ServiceUnavailableException } from '@nestjs/common';
import { HealthController } from './health.controller';

describe('HealthController', () => {
  const ready = {
    status: 'ready',
    ready: true,
    database: { status: 'connected', latencyMs: 2 },
    kafka: { status: 'connected' },
    uptime: 10,
    timestamp: '2026-07-24T12:00:00.000Z',
  } as const;

  it('returns dependency state and measured database latency', async () => {
    const health = { readiness: jest.fn().mockResolvedValue(ready) };
    const controller = new HealthController(health as never);

    await expect(controller.getHealth()).resolves.toEqual({
      status: 'ok',
      database: 'connected',
      databaseLatencyMs: 2,
      kafka: 'connected',
      uptime: 10,
      timestamp: ready.timestamp,
    });
  });

  it('returns service unavailable when readiness loses the database', async () => {
    const health = {
      readiness: jest.fn().mockResolvedValue({
        ...ready,
        status: 'unavailable',
        ready: false,
        database: { status: 'unavailable', latencyMs: 3 },
      }),
    };
    const controller = new HealthController(health as never);

    await expect(controller.getReadiness()).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });

  it('keeps liveness independent from external dependencies', () => {
    const health = { liveness: jest.fn().mockReturnValue({ status: 'live' }) };
    const controller = new HealthController(health as never);

    expect(controller.getLiveness()).toEqual({ status: 'live' });
  });
});
