import { Module } from '@nestjs/common';
import { NotificationModule } from '../notifications/notification.module';
import { ShipmentController } from './controllers/shipment.controller';
import { ShipmentService } from './services/shipment.service';

@Module({
  imports: [NotificationModule],
  controllers: [ShipmentController],
  providers: [ShipmentService],
  exports: [ShipmentService],
})
export class ShipmentModule {}
