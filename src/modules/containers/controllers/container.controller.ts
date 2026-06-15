import {Body,Controller,Param,Post, Get, } from '@nestjs/common';

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

  @Post(':containerId/unload-package')
unloadPackage(
  @Param('containerId') containerId: string,
  @Body() dto: LoadPackageDto,
) {
  return this.containerService.unloadPackage(
    containerId,
    dto,
  );
}

@Get(':containerBarcode')
getContainer(
  @Param('containerBarcode')
  containerBarcode: string,
) {
  return this.containerService.getContainer(
    containerBarcode,
  );
}

@Get(':containerBarcode/history')
getContainerHistory(
  @Param('containerBarcode')
  containerBarcode: string,
) {
  return this.containerService.getContainerHistory(
    containerBarcode,
  );
}


}