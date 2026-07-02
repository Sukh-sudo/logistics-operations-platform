import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Req,
} from '@nestjs/common';
import type { RequestWithId } from '../../../common/middleware/request-id.middleware';
import { AddStopDto } from '../dto/add-stop.dto';
import { CreateRouteDto } from '../dto/create-route.dto';
import { UpdateRouteDto } from '../dto/update-route.dto';
import { RouteService } from '../services/route.service';

@Controller('routes')
export class RouteController {
  constructor(private readonly routeService: RouteService) {}

  @Post()
  create(@Body() dto: CreateRouteDto, @Req() request: RequestWithId) {
    return this.routeService.createRoute(dto, request.requestId);
  }

  @Get()
  findAll() {
    return this.routeService.getRoutes();
  }

  @Post(':id/activate')
  activate(@Param('id') id: string, @Req() request: RequestWithId) {
    return this.routeService.activateRoute(id, request.requestId);
  }

  @Post(':id/retire')
  retire(@Param('id') id: string, @Req() request: RequestWithId) {
    return this.routeService.retireRoute(id, request.requestId);
  }

  @Post(':id/stops')
  addStop(
    @Param('id') id: string,
    @Body() dto: AddStopDto,
    @Req() request: RequestWithId,
  ) {
    return this.routeService.addStop(id, dto, request.requestId);
  }

  @Delete(':id/stops/:stopId')
  removeStop(
    @Param('id') id: string,
    @Param('stopId') stopId: string,
    @Req() request: RequestWithId,
  ) {
    return this.routeService.removeStop(id, stopId, request.requestId);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateRouteDto,
    @Req() request: RequestWithId,
  ) {
    return this.routeService.updateRoute(id, dto, request.requestId);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.routeService.getRoute(id);
  }
}
