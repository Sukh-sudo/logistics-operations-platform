import { Injectable } from '@nestjs/common';

interface RouteMetric {
  requests: number;
  errors: number;
  totalDurationMs: number;
  maxDurationMs: number;
}

@Injectable()
export class MetricsService {
  private readonly startedAt = new Date();
  private readonly routes = new Map<string, RouteMetric>();
  private database = {
    status: 'unknown' as 'unknown' | 'connected' | 'unavailable',
    latencyMs: null as number | null,
    checkedAt: null as string | null,
  };

  recordHttp(method: string, route: string, status: number, durationMs: number) {
    const key = `${method.toUpperCase()} ${route}`;
    const current = this.routes.get(key) ?? {
      requests: 0,
      errors: 0,
      totalDurationMs: 0,
      maxDurationMs: 0,
    };
    current.requests += 1;
    if (status >= 400) current.errors += 1;
    current.totalDurationMs += durationMs;
    current.maxDurationMs = Math.max(current.maxDurationMs, durationMs);
    this.routes.set(key, current);
  }

  recordDatabase(status: 'connected' | 'unavailable', latencyMs: number) {
    this.database = {
      status,
      latencyMs,
      checkedAt: new Date().toISOString(),
    };
  }

  snapshot() {
    let requests = 0;
    let errors = 0;
    let totalDurationMs = 0;
    let maxDurationMs = 0;
    const routes = [...this.routes.entries()].map(([route, metric]) => {
      requests += metric.requests;
      errors += metric.errors;
      totalDurationMs += metric.totalDurationMs;
      maxDurationMs = Math.max(maxDurationMs, metric.maxDurationMs);
      return {
        route,
        requests: metric.requests,
        errors: metric.errors,
        averageResponseTimeMs: this.round(metric.totalDurationMs / metric.requests),
        maxResponseTimeMs: this.round(metric.maxDurationMs),
      };
    });

    return {
      startedAt: this.startedAt.toISOString(),
      uptimeSeconds: Math.floor(process.uptime()),
      requests,
      errors,
      errorRate: requests ? this.round(errors / requests) : 0,
      averageResponseTimeMs: requests ? this.round(totalDurationMs / requests) : 0,
      maxResponseTimeMs: this.round(maxDurationMs),
      database: this.database,
      routes,
    };
  }

  private round(value: number) {
    return Math.round(value * 100) / 100;
  }
}
