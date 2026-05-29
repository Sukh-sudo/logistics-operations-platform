import { Module, NestModule, MiddlewareConsumer, } from '@nestjs/common';

// Database infrastructure module
import { PrismaModule } from './infrastructure/prisma/prisma.module';

// Kafka infrastructure module
import { KafkaModule } from './infrastructure/kafka/kafka.module';

// Operational packages domain module
import { PackageModule } from './modules/packages/package.module';

import { HealthModule } from './modules/health/health.module';

import { RequestIdMiddleware } from './common/middleware/request-id.middleware';

import { ContainerModule } from './modules/containers/container.module';


@Module({
  imports: [
    // Register global Prisma access
    PrismaModule,

    // Register Kafka producer infrastructure
    KafkaModule,

    // Register package operational workflows
    PackageModule,

    HealthModule,

    ContainerModule,
  ],
})
export class AppModule implements NestModule {

  configure(consumer: MiddlewareConsumer) {

    // Attach request IDs to all incoming requests
    consumer.apply(RequestIdMiddleware).forRoutes('*');
  }
}