import {Controller, Get,} from '@nestjs/common';
import {ApiOkResponse, ApiOperation, ApiTags,} from '@nestjs/swagger';
import { DashboardService } from '../services/dashboard.service';

@ApiTags('Dashboard')
@Controller('dashboard')
export class DashboardController {
  constructor(
    private readonly dashboardService: DashboardService,
  ) {}

  @ApiOperation({
  summary: 'Get operational dashboard summary',
})
@ApiOkResponse({
  description: 'Returns package, container and trailer summary statistics.',
})
@Get('summary')
getSummary() {
  return this.dashboardService.getSummary();
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
getRecentEvents() {
  return this.dashboardService.getRecentEvents();
}

}