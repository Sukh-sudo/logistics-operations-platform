import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { ContainerModule } from '../containers/container.module';
import { PackageModule } from '../packages/package.module';
import { TrailerModule } from '../trailers/trailer.module';
import { HandheldAuthController } from './controllers/handheld-auth.controller';
import { HandheldLookupController } from './controllers/handheld-lookup.controller';
import { HandheldScanController } from './controllers/handheld-scan.controller';
import { WorkSessionController } from './controllers/work-session.controller';
import { HandheldService } from './services/handheld.service';

@Module({
  imports: [AuthModule, PackageModule, ContainerModule, TrailerModule],
  controllers: [
    HandheldAuthController,
    WorkSessionController,
    HandheldScanController,
    HandheldLookupController,
  ],
  providers: [HandheldService],
  exports: [HandheldService],
})
export class HandheldModule {}
