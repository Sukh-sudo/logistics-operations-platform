import { Body, Controller, Get, Param, Post, Req } from '@nestjs/common';

import { CreateContainerDto } from '../dto/create-container.dto';
import { LoadPackageDto } from '../dto/load-package.dto';
import { ContainerService } from '../services/container.service';
import type { RequestWithId } from '../../../common/middleware/request-id.middleware';

@Controller('containers')
export class ContainerController {
  constructor(
    private readonly containerService: ContainerService,
  ) {}

  @Post()
  createContainer(
    @Body() dto: CreateContainerDto,
    @Req() req: RequestWithId,
  ) {
    return this.containerService.createContainer(dto, req.correlationId ?? req.requestId);
  }

  @Post(':containerId/load-package')
  loadPackage(
    @Param('containerId') containerId: string,
    @Body() dto: LoadPackageDto,
    @Req() req: RequestWithId,
  ) {
    return this.containerService.loadPackage(
      containerId,
      dto,
      req.correlationId ?? req.requestId,
    );
  }

  @Post(':containerId/unload-package')
unloadPackage(
  @Param('containerId') containerId: string,
  @Body() dto: LoadPackageDto,
  @Req() req: RequestWithId,
) {
  return this.containerService.unloadPackage(
    containerId,
    dto,
    req.correlationId ?? req.requestId,
  );
}


@Get(':containerBarcode/packages')
getContainerPackages(
  @Param('containerBarcode')
  containerBarcode: string,
) {
  return this.containerService.getContainerPackages(
    containerBarcode,
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
