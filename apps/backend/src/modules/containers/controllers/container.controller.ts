import { Body, Controller, Get, Param, Post, Req } from '@nestjs/common';

import { CreateContainerDto } from '../dto/create-container.dto';
import { LoadPackageDto } from '../dto/load-package.dto';
import { ContainerService } from '../services/container.service';
import type { RequestWithId } from '../../../common/middleware/request-id.middleware';
import { PERMISSIONS } from '../../authorization/constants/permissions';
import { Permissions } from '../../authorization/decorators/permissions.decorator';

@Controller('containers')
@Permissions(PERMISSIONS.SYSTEM_ADMIN)
export class ContainerController {
  constructor(
    private readonly containerService: ContainerService,
  ) {}

  @Post()
  @Permissions(PERMISSIONS.CONTAINER_CREATE)
  createContainer(
    @Body() dto: CreateContainerDto,
    @Req() req: RequestWithId,
  ) {
    return this.containerService.createContainer(dto, req.correlationId ?? req.requestId);
  }

  @Post(':containerId/close')
  closeContainer(
    @Param('containerId') containerId: string,
    @Req() req: RequestWithId,
  ) {
    return this.containerService.closeContainer(
      containerId,
      req.correlationId ?? req.requestId,
    );
  }

  @Post(':containerId/load-package')
  @Permissions(PERMISSIONS.CONTAINER_LOAD)
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
  @Permissions(PERMISSIONS.CONTAINER_UNLOAD)
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
