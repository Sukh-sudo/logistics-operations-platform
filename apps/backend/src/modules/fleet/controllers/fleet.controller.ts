import { Body, Controller, Get, Param, Post, Query, Req } from '@nestjs/common';
import type { RequestWithId } from '../../../common/middleware/request-id.middleware';
import { CreateDriverDto } from '../dto/create-driver.dto';
import { CreateTruckDto } from '../dto/create-truck.dto';
import { FleetService } from '../services/fleet.service';
import { AssignEquipmentDto } from '../dto/assign-equipment.dto';
import { FleetAvailabilityQueryDto } from '../dto/fleet-availability-query.dto';
import { AssignmentListQueryDto, DriverListQueryDto, TruckListQueryDto } from '../dto/fleet-list-query.dto';

@Controller('fleet')
export class FleetController {
  constructor(private readonly fleetService: FleetService) {}

  @Post('trucks')
  createTruck(@Body() dto: CreateTruckDto, @Req() request: RequestWithId) {
    return this.fleetService.createTruck(dto, request.correlationId ?? request.requestId);
  }

  @Get('trucks')
  getTrucks(@Query() query: TruckListQueryDto) {
    return this.fleetService.getTrucks(query);
  }

  @Get('trucks/:id')
  getTruck(@Param('id') id: string) {
    return this.fleetService.getTruck(id);
  }

  @Post('drivers')
  createDriver(@Body() dto: CreateDriverDto, @Req() request: RequestWithId) {
    return this.fleetService.createDriver(dto, request.correlationId ?? request.requestId);
  }

  @Get('drivers')
  getDrivers(@Query() query: DriverListQueryDto) {
    return this.fleetService.getDrivers(query);
  }

  @Get('drivers/:id')
  getDriver(@Param('id') id: string) {
    return this.fleetService.getDriver(id);
  }

  @Get('availability')
  getAvailability(@Query() query: FleetAvailabilityQueryDto) {
    return this.fleetService.getAvailability(query.terminalId);
  }

  @Post('assignments')
  assignEquipment(@Body() dto: AssignEquipmentDto, @Req() request: RequestWithId) {
    return this.fleetService.assignEquipment(dto, request.correlationId ?? request.requestId);
  }

  @Get('assignments')
  getAssignments(@Query() query: AssignmentListQueryDto) {
    return this.fleetService.getAssignments(query);
  }

  @Post('assignments/:id/release')
  releaseEquipment(@Param('id') id: string, @Req() request: RequestWithId) {
    return this.fleetService.releaseEquipment(id, request.correlationId ?? request.requestId);
  }
}
