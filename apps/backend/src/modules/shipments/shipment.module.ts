import { Module } from '@nestjs/common';
import { ShipmentController } from './controllers/shipment.controller';
import { ShipmentService } from './services/shipment.service';

@Module({ controllers: [ShipmentController], providers: [ShipmentService], exports: [ShipmentService] })
export class ShipmentModule {}
