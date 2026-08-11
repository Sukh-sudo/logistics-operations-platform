import { Controller, Get, Param } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { PrismaService } from '../../../infrastructure/prisma/prisma.service';
import { ContainerService } from '../../containers/services/container.service';
import { PackageService } from '../../packages/services/package.service';
import { TrailerService } from '../../trailers/services/trailer.service';
import { AllowAuthenticated } from '../../authorization/decorators/allow-authenticated.decorator';

@ApiTags('Handheld lookup')
@Controller('api/mobile/v1')
@AllowAuthenticated()
export class HandheldLookupController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly packages: PackageService,
    private readonly containers: ContainerService,
    private readonly trailers: TrailerService,
  ) {}

  // Lookup endpoints deliberately read snapshots instead of replaying streams.
  @Get('packages/:trackingNumber')
  package(@Param('trackingNumber') trackingNumber: string) {
    return this.packages.getPackage(trackingNumber.trim().toUpperCase());
  }

  @Get('containers/:barcode')
  container(@Param('barcode') barcode: string) {
    return this.containers.getContainer(barcode.trim().toUpperCase());
  }

  @Get('trailers/:trailerId')
  trailer(@Param('trailerId') trailerId: string) {
    return this.trailers.getTrailer(trailerId.trim().toUpperCase());
  }

  @Get('routes/:routeCode')
  route(@Param('routeCode') routeCode: string) {
    return this.prisma.route.findUniqueOrThrow({
      where: { routeNumber: routeCode.trim().toUpperCase() },
      include: { snapshot: true },
    });
  }
}
