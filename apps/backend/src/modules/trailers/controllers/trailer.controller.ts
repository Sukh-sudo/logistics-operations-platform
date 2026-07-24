import { Body, Controller, Get, Param, Post, Req } from '@nestjs/common';
import { TrailerService } from '../services/trailer.service';
import { CreateTrailerDto } from '../dto/create-trailer.dto';
import { LoadContainerDto } from '../dto/load-container.dto';
import { UnloadContainerDto } from '../dto/unload-container.dto';
import { LoadPackageDto } from '../dto/load-package.dto';
import { UnloadPackageDto } from '../dto/unload-package.dto';
import type { RequestWithId } from '../../../common/middleware/request-id.middleware';

@Controller('trailers')
export class TrailerController {
  constructor(
    private readonly trailerService: TrailerService,
  ) {}

  @Post()
  createTrailer(
    @Body() dto: CreateTrailerDto,
    @Req() req: RequestWithId,
  ) {
    return this.trailerService.createTrailer(dto, req.correlationId ?? req.requestId);
  }

  @Post(':trailerId/load-container')
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
