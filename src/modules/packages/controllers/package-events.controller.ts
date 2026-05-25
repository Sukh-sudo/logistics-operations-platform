import { Body, Controller, Post } from '@nestjs/common';
import { CreatePackageEventDto } from '../dto/create-package-event.dto';
import { PackageService } from '../services/package.service';
import { AppLogger } from '../../../common/utils/logger';

@Controller('package-events')
export class PackageEventsController {
  constructor(private readonly packageService: PackageService) {}

  @Post()
async createEvent(@Body() dto: CreatePackageEventDto) {

  // Log incoming operational request
  AppLogger.log(
    `Received package event request for ${dto.trackingNumber}`,
  );

  return this.packageService.createPackageEvent(dto);
}
}