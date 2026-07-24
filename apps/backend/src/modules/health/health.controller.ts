import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { Public } from '../auth/decorators/public.decorator';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { KafkaService } from '../../infrastructure/kafka/kafka.service';

@Controller('health')
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly kafka: KafkaService,
  ) {}

  @Get()
  @Public()
  async getHealth() {
    let database: 'connected' | 'unavailable' = 'connected';
    try {
      await this.prisma.$queryRaw`SELECT 1`;
    } catch {
      database = 'unavailable';
    }

    const result = {
      status: database === 'connected' ? 'ok' : 'degraded',
      database,
      kafka: this.kafka.isHealthy() ? 'connected' : 'unavailable',
      uptime: Math.floor(process.uptime()),
      timestamp: new Date().toISOString(),
    };
    if (database === 'unavailable') {
      throw new ServiceUnavailableException(result);
    }
    return result;
  }
}
