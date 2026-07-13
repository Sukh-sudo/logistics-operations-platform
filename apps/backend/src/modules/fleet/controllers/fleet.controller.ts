import { Body, Controller, Get, Param, Post, Req } from '@nestjs/common';
import type { RequestWithId } from '../../../common/middleware/request-id.middleware';
import { CreateDriverDto } from '../dto/create-driver.dto';
import { CreateTruckDto } from '../dto/create-truck.dto';
import { FleetService } from '../services/fleet.service';
import { AssignEquipmentDto } from '../dto/assign-equipment.dto';

@Controller('fleet')
export class FleetController {
  constructor(private readonly fleetService: FleetService) {}

  @Post('trucks')
  createTruck(@Body() dto: CreateTruckDto, @Req() request: RequestWithId) {
    return this.fleetService.createTruck(dto, request.requestId);
  }

  @Get('trucks')
  getTrucks() {
    return this.fleetService.getTrucks();
  }

  @Get('trucks/:id')
  getTruck(@Param('id') id: string) {
    return this.fleetService.getTruck(id);
  }

  @Post('drivers')
  createDriver(@Body() dto: CreateDriverDto, @Req() request: RequestWithId) {
    return this.fleetService.createDriver(dto, request.requestId);
  }

  @Get('drivers')
  getDrivers() {
    return this.fleetService.getDrivers();
  }

  @Get('drivers/:id')
  getDriver(@Param('id') id: string) {
    return this.fleetService.getDriver(id);
  }

  @Post('assignments')
  assignEquipment(@Body() dto: AssignEquipmentDto, @Req() request: RequestWithId) {
    return this.fleetService.assignEquipment(dto, request.requestId);
  }

  @Get('assignments')
  getAssignments() {
    return this.fleetService.getAssignments();
  }

  @Post('assignments/:id/release')
  releaseEquipment(@Param('id') id: string, @Req() request: RequestWithId) {
    return this.fleetService.releaseEquipment(id, request.requestId);
  }
}
