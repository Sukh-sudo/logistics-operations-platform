import {Body, Controller, Post, Param,} from '@nestjs/common';
import { TrailerService } from '../services/trailer.service';
import { CreateTrailerDto } from '../dto/create-trailer.dto';
import { LoadContainerDto } from '../dto/load-container.dto';

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
}
