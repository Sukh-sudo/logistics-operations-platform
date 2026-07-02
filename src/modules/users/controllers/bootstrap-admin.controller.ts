import { Body, Controller, Post, Req } from '@nestjs/common';
import { ApiCreatedResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { RequestWithId } from '../../../common/middleware/request-id.middleware';
import { BootstrapAdminDto } from '../dto/bootstrap-admin.dto';
import { UserService } from '../services/user.service';

@ApiTags('Bootstrap')
@Controller('bootstrap')
export class BootstrapAdminController {
  constructor(private readonly users: UserService) {}

  @Post('admin')
  @ApiOperation({ summary: 'Provision an active administrator using the server bootstrap secret' })
  @ApiCreatedResponse({ description: 'Administrator, ADMIN role, permissions, events, and snapshot created.' })
  create(@Body() dto: BootstrapAdminDto, @Req() request: RequestWithId) {
    return this.users.bootstrapAdmin(dto, request.requestId);
  }
}
