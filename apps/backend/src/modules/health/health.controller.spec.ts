import { ServiceUnavailableException } from '@nestjs/common';
import { HealthController } from './health.controller';

describe('HealthController', () => {
  it('reports live dependency state', async () => {
    const prisma = { $queryRaw: jest.fn().mockResolvedValue([{ '?column?': 1 }]) };
    const kafka = { isHealthy: jest.fn().mockReturnValue(true) };
    const controller = new HealthController(prisma as never, kafka as never);

    await expect(controller.getHealth()).resolves.toEqual(
      expect.objectContaining({
        status: 'ok',
        database: 'connected',
        kafka: 'connected',
        uptime: expect.any(Number),
        timestamp: expect.any(String),
      }),
    );
  });

  it('returns service unavailable when the database probe fails', async () => {
    const prisma = { $queryRaw: jest.fn().mockRejectedValue(new Error('offline')) };
    const kafka = { isHealthy: jest.fn().mockReturnValue(false) };
    const controller = new HealthController(prisma as never, kafka as never);

    await expect(controller.getHealth()).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });
});
