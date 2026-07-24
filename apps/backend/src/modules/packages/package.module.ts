import { Module } from '@nestjs/common';

import { PackageEventsController } from './controllers/package-events.controller';
import { PackageService } from './services/package.service';
import { PackageTransitionValidator } from './validators/package-transition.validator';
import { ShipmentModule } from '../shipments/shipment.module';


@Module({
  imports: [ShipmentModule],
  controllers: [PackageEventsController],
  providers: [PackageService, PackageTransitionValidator,],
})
export class PackageModule {}
