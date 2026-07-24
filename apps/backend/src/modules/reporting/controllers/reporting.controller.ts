import { Controller, Get, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

import { DeliveryReportQueryDto } from '../dto/delivery-report-query.dto';
import { ReportingService } from '../services/reporting.service';

@ApiTags('Reporting')
@Controller('reports')
export class ReportingController {
  constructor(private readonly service: ReportingService) {}

  @Get('deliveries')
  @ApiOperation({ summary: 'Get snapshot-backed delivery performance' })
  deliveries(@Query() query: DeliveryReportQueryDto) {
    return this.service.getDeliveryReport(query);
  }
}
