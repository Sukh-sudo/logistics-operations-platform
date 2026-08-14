import {
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

import type { AuthenticatedRequest } from '../../auth/interfaces/authenticated-request.interface';
import { AllowAuthenticated } from '../../authorization/decorators/allow-authenticated.decorator';
import { NotificationQueryDto } from '../dto/notification-query.dto';
import { NotificationService } from '../services/notification.service';

@ApiTags('Notifications')
@Controller('notifications')
// Every authenticated user may enter this controller, but the service scopes
// every object to the recipient unless the caller is a system administrator.
@AllowAuthenticated()
export class NotificationController {
  constructor(private readonly service: NotificationService) {}

  @Get()
  @ApiOperation({ summary: 'List in-app customer notifications' })
  findAll(
    @Query() query: NotificationQueryDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.service.getNotifications(query, request.user);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get notification delivery history' })
  findOne(@Param('id') id: string, @Req() request: AuthenticatedRequest) {
    return this.service.getNotification(id, request.user);
  }

  @Patch(':id/read')
  @ApiOperation({ summary: 'Mark a notification as read' })
  markRead(@Param('id') id: string, @Req() request: AuthenticatedRequest) {
    return this.service.markRead(
      id,
      request.user,
      request.correlationId ?? request.requestId,
    );
  }

  @Post(':id/resend')
  @ApiOperation({ summary: 'Request another in-app delivery attempt' })
  resend(@Param('id') id: string, @Req() request: AuthenticatedRequest) {
    return this.service.resend(
      id,
      request.user,
      request.correlationId ?? request.requestId,
    );
  }
}
