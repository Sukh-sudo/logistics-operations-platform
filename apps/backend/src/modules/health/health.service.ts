import { Injectable } from '@nestjs/common';
import { MetricsService } from '../../common/observability/metrics.service';
import { KafkaService } from '../../infrastructure/kafka/kafka.service';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';

export interface DependencyProbe {
  status: 'connected' | 'unavailable';
  latencyMs: number;
}

@Injectable()
export class HealthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly kafka: KafkaService,
    private readonly metrics: MetricsService,
  ) {}

  liveness() {
    return {
      status: 'live',
      uptime: Math.floor(process.uptime()),
      timestamp: new Date().toISOString(),
    };
  }

  async database(): Promise<DependencyProbe> {
    const started = performance.now();
    let status: DependencyProbe['status'] = 'connected';
    try {
      await this.prisma.$queryRaw`SELECT 1`;
    } catch {
      status = 'unavailable';
    }
    const latencyMs = Math.round((performance.now() - started) * 100) / 100;
    this.metrics.recordDatabase(status, latencyMs);
    return { status, latencyMs };
  }

  kafkaStatus() {
    return {
      status: this.kafka.isHealthy() ? 'connected' as const : 'unavailable' as const,
    };
  }

  async readiness() {
    const database = await this.database();
    const kafka = this.kafkaStatus();
    return {
      status: database.status === 'connected'
        ? kafka.status === 'connected' ? 'ready' : 'degraded'
        : 'unavailable',
      ready: database.status === 'connected',
      database,
      kafka,
      uptime: Math.floor(process.uptime()),
      timestamp: new Date().toISOString(),
    };
  }
}
