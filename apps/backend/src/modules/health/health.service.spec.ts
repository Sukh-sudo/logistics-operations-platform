import { HealthService } from './health.service';

describe('HealthService', () => {
  it('executes a real database probe and records its latency', async () => {
    const prisma = { $queryRaw: jest.fn().mockResolvedValue([{ value: 1 }]) };
    const kafka = { isHealthy: jest.fn().mockReturnValue(true) };
    const metrics = { recordDatabase: jest.fn() };
    const service = new HealthService(prisma as never, kafka as never, metrics as never);

    await expect(service.readiness()).resolves.toEqual(expect.objectContaining({
      status: 'ready',
      ready: true,
      database: expect.objectContaining({ status: 'connected', latencyMs: expect.any(Number) }),
      kafka: { status: 'connected' },
    }));
    expect(prisma.$queryRaw).toHaveBeenCalled();
    expect(metrics.recordDatabase).toHaveBeenCalledWith('connected', expect.any(Number));
  });

  it('reports unavailable when PostgreSQL cannot answer the probe', async () => {
    const prisma = { $queryRaw: jest.fn().mockRejectedValue(new Error('offline')) };
    const kafka = { isHealthy: jest.fn().mockReturnValue(false) };
    const metrics = { recordDatabase: jest.fn() };
    const service = new HealthService(prisma as never, kafka as never, metrics as never);

    await expect(service.readiness()).resolves.toEqual(expect.objectContaining({
      status: 'unavailable',
      ready: false,
      database: expect.objectContaining({ status: 'unavailable' }),
    }));
  });
});
