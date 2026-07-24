import { Controller, Get } from '@nestjs/common';
import { TripStatus } from '@prisma/client';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { MetricsService } from './metrics.service';

@Controller('metrics')
export class MetricsController {
  constructor(
    private readonly metrics: MetricsService,
    private readonly prisma: PrismaService,
  ) {}

  @Get()
  async getMetrics() {
    const since = new Date(Date.now() - 5 * 60 * 1000);
    const [activeTrips, packageThroughput, trailerThroughput] =
      await Promise.allSettled([
        this.prisma.tripSnapshot.count({
          where: { currentStatus: TripStatus.IN_PROGRESS },
        }),
        this.prisma.packageEvent.count({ where: { createdAt: { gte: since } } }),
        this.prisma.trailerEvent.count({ where: { createdAt: { gte: since } } }),
      ]);

    return {
      api: this.metrics.snapshot(),
      business: {
        activeTrips: this.value(activeTrips),
        packageEventsLastFiveMinutes: this.value(packageThroughput),
        trailerEventsLastFiveMinutes: this.value(trailerThroughput),
      },
      generatedAt: new Date().toISOString(),
    };
  }

  private value(result: PromiseSettledResult<number>) {
    return result.status === 'fulfilled' ? result.value : null;
  }
}
