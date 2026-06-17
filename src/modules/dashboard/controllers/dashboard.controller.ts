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


}