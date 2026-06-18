import {Controller, Get,} from '@nestjs/common';

import { DashboardService } from '../services/dashboard.service';

@Controller('dashboard')
export class DashboardController {
  constructor(
    private readonly dashboardService: DashboardService,
  ) {}

  @Get('summary')
  getSummary() {
    return this.dashboardService.getSummary();
  }

  @Get('trailers')
getTrailers() {
  return this.dashboardService.getTrailers();
}

// Returns all container summaries for the dashboard
@Get('containers')
getContainers() {
  return this.dashboardService.getContainers();
}

// Returns the latest operational activity
@Get('recent-events')
getRecentEvents() {
  return this.dashboardService.getRecentEvents();
}

// Returns all package locations for the dashboard
@Get('packages')
getPackages() {
  return this.dashboardService.getPackages();
}

}