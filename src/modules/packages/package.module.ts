import { Module } from '@nestjs/common';

import { PackageEventsController } from './controllers/package-events.controller';
import { PackageService } from './services/package.service';

@Module({
  controllers: [PackageEventsController],
  providers: [PackageService],
})
export class PackageModule {}