import { Body, Controller, Post, Get, Param, } from '@nestjs/common';
import { CreatePackageEventDto } from '../dto/create-package-event.dto';
import { PackageService } from '../services/package.service';
import { Req } from '@nestjs/common';
import type {RequestWithId,} from '../../../common/middleware/request-id.middleware';
import { PERMISSIONS } from '../../authorization/constants/permissions';
import { Permissions } from '../../authorization/decorators/permissions.decorator';

@Controller('package-events')
@Permissions(PERMISSIONS.SYSTEM_ADMIN)
export class PackageEventsController {
  constructor(private readonly packageService: PackageService) {}

  @Post()
  @Permissions(PERMISSIONS.PACKAGE_UPDATE)
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
@Permissions(PERMISSIONS.PACKAGE_HISTORY)
getPackageHistory(
  @Param('trackingNumber') trackingNumber: string,
) {
  return this.packageService.getPackageHistory(
    trackingNumber,
  );
}

@Get(':trackingNumber/location')
@Permissions(PERMISSIONS.PACKAGE_VIEW)
getPackageLocation(
  @Param('trackingNumber')
  trackingNumber: string,
) {
  return this.packageService.getPackageLocation(
    trackingNumber,
  );
}

@Get(':trackingNumber')
@Permissions(PERMISSIONS.PACKAGE_VIEW)
  getPackage(
  @Param('trackingNumber') trackingNumber: string,
) {
  return this.packageService.getPackage(
    trackingNumber,
  );
}

}
