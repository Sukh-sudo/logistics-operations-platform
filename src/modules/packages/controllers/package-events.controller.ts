import { Body, Controller, Post } from '@nestjs/common';
import { CreatePackageEventDto } from '../dto/create-package-event.dto';
import { PackageService } from '../services/package.service';

@Controller('package-events')
export class PackageEventsController {
  constructor(private readonly packageService: PackageService) {}

  @Post()
  async createEvent(@Body() dto: CreatePackageEventDto) {
    return this.packageService.createPackageEvent(dto);
  }
}