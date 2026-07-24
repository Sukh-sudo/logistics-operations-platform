import { MetricsService } from './metrics.service';

describe('MetricsService', () => {
  it('aggregates response time, errors, routes, and database latency', () => {
    const service = new MetricsService();
    service.recordHttp('GET', '/packages', 200, 10);
    service.recordHttp('GET', '/packages', 500, 30);
    service.recordDatabase('connected', 4.5);

    expect(service.snapshot()).toEqual(expect.objectContaining({
      requests: 2,
      errors: 1,
      errorRate: 0.5,
      averageResponseTimeMs: 20,
      maxResponseTimeMs: 30,
      database: expect.objectContaining({
        status: 'connected',
        latencyMs: 4.5,
      }),
      routes: [expect.objectContaining({
        route: 'GET /packages',
        requests: 2,
        errors: 1,
      })],
    }));
  });
});
