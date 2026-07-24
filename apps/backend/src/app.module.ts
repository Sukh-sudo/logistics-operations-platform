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

import { TrailerModule } from './modules/trailers/trailer.module';
import { SearchModule } from './modules/search/search.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { TerminalModule } from './modules/terminals/terminal.module';
import { UserModule } from './modules/users/user.module';
import { AuthModule } from './modules/auth/auth.module';
import { AuthorizationModule } from './modules/authorization/authorization.module';
import { RouteModule } from './modules/routes/route.module';
import { TripModule } from './modules/trips/trip.module';
import { ShipmentModule } from './modules/shipments/shipment.module';
import { FleetModule } from './modules/fleet/fleet.module';
import { NotificationModule } from './modules/notifications/notification.module';
import { TrackingModule } from './modules/tracking/tracking.module';
import { ReportingModule } from './modules/reporting/reporting.module';

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

    TrailerModule,

    SearchModule,

    DashboardModule,

    TerminalModule,

    UserModule,

    AuthModule,

    AuthorizationModule,

    RouteModule,

    TripModule,

    ShipmentModule,

    FleetModule,

    NotificationModule,

    TrackingModule,

    ReportingModule,
  ],
})
export class AppModule implements NestModule {

  configure(consumer: MiddlewareConsumer) {

    // Attach request IDs to all incoming requests
    consumer.apply(RequestIdMiddleware).forRoutes('*');
  }
}
