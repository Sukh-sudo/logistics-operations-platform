import { Body, Controller, Get, Param, Patch, Post, Req } from '@nestjs/common';
import type { RequestWithId } from '../../../common/middleware/request-id.middleware';
import { CreateTripDto } from '../dto/create-trip.dto';
import { TripStopActionDto } from '../dto/trip-stop-action.dto';
import { UpdateTripDto } from '../dto/update-trip.dto';
import { TripService } from '../services/trip.service';

@Controller('trips')
export class TripController {
  constructor(private readonly service: TripService) {}

  @Post() create(@Body() dto: CreateTripDto, @Req() req: RequestWithId) { return this.service.createTrip(dto, req.requestId); }
  @Get() findAll() { return this.service.getTrips(); }
  @Get(':id') findOne(@Param('id') id: string) { return this.service.getTrip(id); }
  @Patch(':id') update(@Param('id') id: string, @Body() dto: UpdateTripDto, @Req() req: RequestWithId) { return this.service.updateTrip(id, dto, req.requestId); }
  @Post(':id/start') start(@Param('id') id: string, @Req() req: RequestWithId) { return this.service.startTrip(id, req.requestId); }
  @Post(':id/stops/:stopId/arrive') arrive(@Param('id') id: string, @Param('stopId') stopId: string, @Body() dto: TripStopActionDto, @Req() req: RequestWithId) { return this.service.arriveStop(id, stopId, dto, req.requestId); }
  @Post(':id/stops/:stopId/depart') depart(@Param('id') id: string, @Param('stopId') stopId: string, @Body() dto: TripStopActionDto, @Req() req: RequestWithId) { return this.service.departStop(id, stopId, dto, req.requestId); }
  @Post(':id/complete') complete(@Param('id') id: string, @Req() req: RequestWithId) { return this.service.completeTrip(id, req.requestId); }
  @Post(':id/cancel') cancel(@Param('id') id: string, @Req() req: RequestWithId) { return this.service.cancelTrip(id, req.requestId); }
}
