import { Body, Controller, Get, Param, Post, Req } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { AuthenticatedRequest } from '../../auth/interfaces/authenticated-request.interface';
import { PERMISSIONS } from '../../authorization/constants/permissions';
import { Permissions } from '../../authorization/decorators/permissions.decorator';
import { EnrollHandheldDeviceDto } from '../dto/enroll-handheld-device.dto';
import { HandheldDeviceService } from '../services/handheld-device.service';

@ApiTags('Handheld device administration')
@Controller('handheld-devices')
@Permissions(PERMISSIONS.SYSTEM_ADMIN)
export class HandheldDeviceController {
  constructor(private readonly devices: HandheldDeviceService) {}

  @Post()
  @ApiOperation({ summary: 'Enroll a device and issue its one-time credential' })
  enroll(
    @Body() dto: EnrollHandheldDeviceDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.devices.enroll(
      dto,
      request.user.userId,
      request.correlationId ?? request.requestId,
    );
  }

  @Get()
  @ApiOperation({ summary: 'List current handheld device snapshots' })
  list() {
    return this.devices.list();
  }

  @Post(':id/revoke')
  @ApiOperation({ summary: 'Revoke a device and its refresh sessions' })
  revoke(@Param('id') id: string, @Req() request: AuthenticatedRequest) {
    return this.devices.revoke(
      id,
      request.user.userId,
      request.correlationId ?? request.requestId,
    );
  }
}
