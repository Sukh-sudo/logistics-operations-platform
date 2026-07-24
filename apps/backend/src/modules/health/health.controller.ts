import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { Public } from '../auth/decorators/public.decorator';
import { HealthService } from './health.service';

@Controller('health')
export class HealthController {
  constructor(private readonly health: HealthService) {}

  @Get()
  @Public()
  async getHealth() {
    const readiness = await this.health.readiness();
    const result = {
      status: readiness.ready
        ? readiness.kafka.status === 'connected' ? 'ok' : 'degraded'
        : 'unavailable',
      database: readiness.database.status,
      databaseLatencyMs: readiness.database.latencyMs,
      kafka: readiness.kafka.status,
      uptime: readiness.uptime,
      timestamp: readiness.timestamp,
    };
    if (!readiness.ready) {
      throw new ServiceUnavailableException(result);
    }
    return result;
  }

  @Get('live')
  @Public()
  getLiveness() {
    return this.health.liveness();
  }

  @Get('ready')
  @Public()
  async getReadiness() {
    const result = await this.health.readiness();
    if (!result.ready) throw new ServiceUnavailableException(result);
    return result;
  }

  @Get('database')
  @Public()
  async getDatabaseHealth() {
    const result = await this.health.database();
    if (result.status === 'unavailable') {
      throw new ServiceUnavailableException(result);
    }
    return result;
  }

  @Get('kafka')
  @Public()
  getKafkaHealth() {
    const result = this.health.kafkaStatus();
    if (result.status === 'unavailable') {
      throw new ServiceUnavailableException(result);
    }
    return result;
  }
}
