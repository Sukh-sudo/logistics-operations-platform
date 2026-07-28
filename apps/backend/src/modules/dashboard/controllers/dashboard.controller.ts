import { Controller, Get, Query } from '@nestjs/common';
import {ApiOkResponse, ApiOperation, ApiTags,} from '@nestjs/swagger';
import { DashboardQueryDto } from '../dto/dashboard-query.dto';
import { DashboardService } from '../services/dashboard.service';
import { HandheldDashboardQueryDto } from '../dto/handheld-dashboard-query.dto';

@ApiTags('Dashboard')
@Controller('dashboard')
export class DashboardController {
  constructor(
    private readonly dashboardService: DashboardService,
  ) {}

@Get('terminal-kpis/handheld')
getHandheldKpis(@Query() query: HandheldDashboardQueryDto) {
  return this.dashboardService.getHandheldKpis(query);
}

@Get('terminal-kpis/handheld/employees')
getHandheldEmployees(@Query() query: HandheldDashboardQueryDto) {
  return this.dashboardService.getHandheldEmployees(query);
}

@Get('terminal-kpis/handheld/exceptions')
getHandheldExceptions(@Query() query: HandheldDashboardQueryDto) {
  return this.dashboardService.getHandheldExceptions(query);
}

@Get('terminal-kpis/handheld/unloaded-containers')
getClosedContainersNotLoaded(@Query() query: HandheldDashboardQueryDto) {
  return this.dashboardService.getClosedContainersNotLoaded(query);
}

  @ApiOperation({
  summary: 'Get operational dashboard summary',
})
@ApiOkResponse({
  description: 'Returns package, container and trailer summary statistics.',
})
@Get('summary')
getSummary(@Query() query: DashboardQueryDto) {
  return this.dashboardService.getSummary(query);
}

 @ApiOperation({
  summary: 'Get all active trailers',
})
@ApiOkResponse({
  description: 'Returns trailer operational information.',
})
@Get('trailers')
getTrailers() {
  return this.dashboardService.getTrailers();
}

// Returns all container summaries for the dashboard
@ApiOperation({
  summary: 'Get all containers',
})
@ApiOkResponse({
  description: 'Returns container operational information.',
})
@Get('containers')
getContainers() {
  return this.dashboardService.getContainers();
}

// Returns all package locations for the dashboard
@ApiOperation({
  summary: 'Get all packages',
})
@ApiOkResponse({
  description: 'Returns package operational information.',
})
@Get('packages')
getPackages() {
  return this.dashboardService.getPackages();
}

@ApiOperation({
  summary: 'Get recent operational events',
})
@ApiOkResponse({
  description: 'Returns the latest package, container and trailer events.',
})
@Get('recent-events')
getRecentEvents(@Query() query: DashboardQueryDto) {
  return this.dashboardService.getRecentEvents(query);
}

}
