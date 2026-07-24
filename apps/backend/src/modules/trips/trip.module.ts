import { Module } from '@nestjs/common';
import { TripController } from './controllers/trip.controller';
import { TripService } from './services/trip.service';
import { PackageModule } from '../packages/package.module';

@Module({
  imports: [PackageModule],
  controllers: [TripController],
  providers: [TripService],
  exports: [TripService],
})
export class TripModule {}
