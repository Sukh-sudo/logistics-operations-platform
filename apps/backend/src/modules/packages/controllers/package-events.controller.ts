import { Body, Controller, Post, Get, Param, } from '@nestjs/common';
import { CreatePackageEventDto } from '../dto/create-package-event.dto';
import { PackageService } from '../services/package.service';
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

    return this.packageService.createPackageEvent(
      dto,
      req.correlationId ?? req.requestId,
    );
  }

  @Post('projections/retry')
  retryPendingProjections() {
    return this.packageService.retryPendingProjections();
  }


@Get(':trackingNumber/history')
getPackageHistory(
  @Param('trackingNumber') trackingNumber: string,
) {
  return this.packageService.getPackageHistory(
    trackingNumber,
  );
}

@Get(':trackingNumber/location')
getPackageLocation(
  @Param('trackingNumber')
  trackingNumber: string,
) {
  return this.packageService.getPackageLocation(
    trackingNumber,
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

}
