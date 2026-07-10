import { Module } from '@nestjs/common';
import { FleetController } from './controllers/fleet.controller';
import { FleetService } from './services/fleet.service';

@Module({
  controllers: [FleetController],
  providers: [FleetService],
  exports: [FleetService],
})
export class FleetModule {}
