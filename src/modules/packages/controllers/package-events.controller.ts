import { Body, Controller, Post, Get, Param, } from '@nestjs/common';
import { CreatePackageEventDto } from '../dto/create-package-event.dto';
import { PackageService } from '../services/package.service';
import { AppLogger } from '../../../common/utils/logger';
import { Req } from '@nestjs/common';
import type {RequestWithId,} from '../../../common/middleware/request-id.middleware';

@Controller('package-events')
export class PackageEventsController {
  constructor(private readonly packageService: PackageService) {}

  @Post()
  async createEvent(
    @Body() dto: CreatePackageEventDto,

    @Req() req: RequestWithId,
  ) {

    // Log incoming request with correlation ID
    AppLogger.log(
      `[${req.requestId}] Received package event request for ${dto.trackingNumber}`,
    );

    return this.packageService.createPackageEvent(
      dto,
      req.requestId,
    );
  }

@Get(':trackingNumber')
  getPackage(
  @Param('trackingNumber') trackingNumber: string,
) {
  return this.packageService.getPackage(
    trackingNumber,
  );
}
@Get(':trackingNumber/history')
getPackageHistory(
  @Param('trackingNumber') trackingNumber: string,
) {
  return this.packageService.getPackageHistory(
    trackingNumber,
  );
}

}