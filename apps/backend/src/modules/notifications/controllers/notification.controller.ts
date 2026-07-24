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

import type { RequestWithId } from '../../../common/middleware/request-id.middleware';
import { NotificationQueryDto } from '../dto/notification-query.dto';
import { NotificationService } from '../services/notification.service';

@ApiTags('Notifications')
@Controller('notifications')
export class NotificationController {
  constructor(private readonly service: NotificationService) {}

  @Get()
  @ApiOperation({ summary: 'List in-app customer notifications' })
  findAll(@Query() query: NotificationQueryDto) {
    return this.service.getNotifications(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get notification delivery history' })
  findOne(@Param('id') id: string) {
    return this.service.getNotification(id);
  }

  @Patch(':id/read')
  @ApiOperation({ summary: 'Mark a notification as read' })
  markRead(@Param('id') id: string, @Req() req: RequestWithId) {
    return this.service.markRead(id, req.requestId);
  }

  @Post(':id/resend')
  @ApiOperation({ summary: 'Request another in-app delivery attempt' })
  resend(@Param('id') id: string, @Req() req: RequestWithId) {
    return this.service.resend(id, req.requestId);
  }
}
