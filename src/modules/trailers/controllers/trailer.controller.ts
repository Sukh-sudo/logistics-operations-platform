import {Body, Controller, Post, Param, Get,} from '@nestjs/common';
import { TrailerService } from '../services/trailer.service';
import { CreateTrailerDto } from '../dto/create-trailer.dto';
import { LoadContainerDto } from '../dto/load-container.dto';
import { UnloadContainerDto } from '../dto/unload-container.dto';
import { LoadPackageDto } from '../dto/load-package.dto';
import { UnloadPackageDto } from '../dto/unload-package.dto';

@Controller('trailers')
export class TrailerController {
  constructor(
    private readonly trailerService: TrailerService,
  ) {}

  @Post()
  createTrailer(
    @Body() dto: CreateTrailerDto,
  ) {
    return this.trailerService.createTrailer(dto);
  }

  @Post(':trailerId/load-container')
loadContainer(
  @Param('trailerId') trailerId: string,
  @Body() dto: LoadContainerDto,
) {
  return this.trailerService.loadContainer(
    trailerId,
    dto,
  );
}

@Post(':trailerId/unload-container')
unloadContainer(
  @Param('trailerId') trailerId: string,
  @Body() dto: UnloadContainerDto,
) {
  return this.trailerService.unloadContainer(
    trailerId,
    dto,
  );
}

@Post(':trailerId/load-package')
loadPackage(
  @Param('trailerId') trailerId: string,
  @Body() dto: LoadPackageDto,
) {
  return this.trailerService.loadPackage(
    trailerId,
    dto,
  );
}

@Post(':trailerId/unload-package')
unloadPackage(
  @Param('trailerId') trailerId: string,
  @Body() dto: UnloadPackageDto,
) {
  return this.trailerService.unloadPackage(
    trailerId,
    dto,
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

@Get(':trailerBarcode')
getTrailer(
  @Param('trailerBarcode')
  trailerBarcode: string,
) {
  return this.trailerService.getTrailer(
    trailerBarcode,
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

}
