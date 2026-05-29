import {Body,Controller,Param,Post,} from '@nestjs/common';

import { CreateContainerDto } from '../dto/create-container.dto';
import { LoadPackageDto } from '../dto/load-package.dto';
import { ContainerService } from '../services/container.service';

@Controller('containers')
export class ContainerController {
  constructor(
    private readonly containerService: ContainerService,
  ) {}

  @Post()
  createContainer(
    @Body() dto: CreateContainerDto,
  ) {
    return this.containerService.createContainer(dto);
  }

  @Post(':containerId/load-package')
  loadPackage(
    @Param('containerId') containerId: string,
    @Body() dto: LoadPackageDto,
  ) {
    return this.containerService.loadPackage(
      containerId,
      dto,
    );
  }
}