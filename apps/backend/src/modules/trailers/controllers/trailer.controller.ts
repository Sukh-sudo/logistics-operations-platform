import { Body, Controller, Get, Param, Post, Req } from '@nestjs/common';
import { TrailerService } from '../services/trailer.service';
import { CreateTrailerDto } from '../dto/create-trailer.dto';
import { LoadContainerDto } from '../dto/load-container.dto';
import { UnloadContainerDto } from '../dto/unload-container.dto';
import { LoadPackageDto } from '../dto/load-package.dto';
import { UnloadPackageDto } from '../dto/unload-package.dto';
import type { RequestWithId } from '../../../common/middleware/request-id.middleware';
import { PERMISSIONS } from '../../authorization/constants/permissions';
import { Permissions } from '../../authorization/decorators/permissions.decorator';

@Controller('trailers')
@Permissions(PERMISSIONS.SYSTEM_ADMIN)
export class TrailerController {
  constructor(
    private readonly trailerService: TrailerService,
  ) {}

  @Post()
  @Permissions(PERMISSIONS.TRAILER_CREATE)
  createTrailer(
    @Body() dto: CreateTrailerDto,
    @Req() req: RequestWithId,
  ) {
    return this.trailerService.createTrailer(dto, req.correlationId ?? req.requestId);
  }

  @Post(':trailerId/close')
  @Permissions(PERMISSIONS.TRAILER_DEPART)
  closeTrailer(
    @Param('trailerId') trailerId: string,
    @Req() req: RequestWithId,
  ) {
    return this.trailerService.closeTrailer(
      trailerId,
      req.correlationId ?? req.requestId,
    );
  }

  @Post(':trailerId/load-container')
  @Permissions(PERMISSIONS.TRAILER_LOAD)
loadContainer(
  @Param('trailerId') trailerId: string,
  @Body() dto: LoadContainerDto,
  @Req() req: RequestWithId,
) {
  return this.trailerService.loadContainer(
    trailerId,
    dto,
    req.correlationId ?? req.requestId,
  );
}

@Post(':trailerId/unload-container')
unloadContainer(
  @Param('trailerId') trailerId: string,
  @Body() dto: UnloadContainerDto,
  @Req() req: RequestWithId,
) {
  return this.trailerService.unloadContainer(
    trailerId,
    dto,
    req.correlationId ?? req.requestId,
  );
}

  @Post(':trailerId/load-package')
  @Permissions(PERMISSIONS.TRAILER_LOAD)
loadPackage(
  @Param('trailerId') trailerId: string,
  @Body() dto: LoadPackageDto,
  @Req() req: RequestWithId,
) {
  return this.trailerService.loadPackage(
    trailerId,
    dto,
    req.correlationId ?? req.requestId,
  );
}

@Post(':trailerId/unload-package')
unloadPackage(
  @Param('trailerId') trailerId: string,
  @Body() dto: UnloadPackageDto,
  @Req() req: RequestWithId,
) {
  return this.trailerService.unloadPackage(
    trailerId,
    dto,
    req.correlationId ?? req.requestId,
  );
}

@Get(':trailerBarcode/history')
getTrailerHistory(
  @Param('trailerBarcode')
  trailerBarcode: string,
) {
  return this.trailerService.getTrailerHistory(
    trailerBarcode,
  );
}

@Get(':trailerBarcode/containers')
getTrailerContainers(
  @Param('trailerBarcode')
  trailerBarcode: string,
) {
  return this.trailerService.getTrailerContainers(
    trailerBarcode,
  );
}

@Get(':trailerBarcode/packages')
getTrailerPackages(
  @Param('trailerBarcode')
  trailerBarcode: string,
) {
  return this.trailerService.getTrailerPackages(
    trailerBarcode,
  );
}

@Get(':trailerBarcode')
getTrailer(
  @Param('trailerBarcode')
  trailerBarcode: string,
) {
  return this.trailerService.getTrailer(
    trailerBarcode,
  );
}


}
