import { Controller, Get, Param } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

import { TrackingService } from '../services/tracking.service';

@ApiTags('Customer Tracking')
@Controller('tracking')
export class TrackingController {
  constructor(private readonly service: TrackingService) {}

  @Get(':shipmentNumber')
  @ApiOperation({ summary: 'Track a shipment by its customer-facing number' })
  track(@Param('shipmentNumber') shipmentNumber: string) {
    return this.service.trackShipment(shipmentNumber);
  }
}
