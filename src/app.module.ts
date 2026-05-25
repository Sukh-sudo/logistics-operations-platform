import { Module } from '@nestjs/common';

// Database infrastructure module
import { PrismaModule } from './infrastructure/prisma/prisma.module';

// Kafka infrastructure module
import { KafkaModule } from './infrastructure/kafka/kafka.module';

// Operational packages domain module
import { PackageModule } from './modules/packages/package.module';

import { HealthModule } from './modules/health/health.module';

@Module({
  imports: [
    // Register global Prisma access
    PrismaModule,

    // Register Kafka producer infrastructure
    KafkaModule,

    // Register package operational workflows
    PackageModule,

    HealthModule,
  ],
})
export class AppModule {}