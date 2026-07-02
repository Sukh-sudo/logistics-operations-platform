import { Body, Controller, Get, Param, Patch, Post, Req } from '@nestjs/common';
import type { RequestWithId } from '../../../common/middleware/request-id.middleware';
import { CreateShipmentDto } from '../dto/create-shipment.dto';
import { ShipmentPackageDto } from '../dto/shipment-package.dto';
import { UpdateShipmentDto } from '../dto/update-shipment.dto';
import { ShipmentService } from '../services/shipment.service';

@Controller('shipments')
export class ShipmentController {
  constructor(private readonly service: ShipmentService) {}

  @Post() create(@Body() dto: CreateShipmentDto, @Req() req: RequestWithId) { return this.service.createShipment(dto, req.requestId); }
  @Get() findAll() { return this.service.getShipments(); }
  @Get(':id/history') history(@Param('id') id: string) { return this.service.getHistory(id); }
  @Get(':id/packages') packages(@Param('id') id: string) { return this.service.getPackages(id); }
  @Get(':id') findOne(@Param('id') id: string) { return this.service.getShipment(id); }
  @Patch(':id') update(@Param('id') id: string, @Body() dto: UpdateShipmentDto, @Req() req: RequestWithId) { return this.service.updateShipment(id, dto, req.requestId); }
  @Post(':id/assign-package') assign(@Param('id') id: string, @Body() dto: ShipmentPackageDto, @Req() req: RequestWithId) { return this.service.assignPackage(id, dto, req.requestId); }
  @Post(':id/remove-package') remove(@Param('id') id: string, @Body() dto: ShipmentPackageDto, @Req() req: RequestWithId) { return this.service.removePackage(id, dto, req.requestId); }
  @Post(':id/complete') complete(@Param('id') id: string, @Req() req: RequestWithId) { return this.service.completeShipment(id, req.requestId); }
  @Post(':id/cancel') cancel(@Param('id') id: string, @Req() req: RequestWithId) { return this.service.cancelShipment(id, req.requestId); }
}
