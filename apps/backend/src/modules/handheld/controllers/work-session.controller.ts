import { Body, Controller, Get, Param, Post, Req } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { AuthenticatedRequest } from '../../auth/interfaces/authenticated-request.interface';
import { CreateWorkSessionDto } from '../dto/create-work-session.dto';
import { HandheldService } from '../services/handheld.service';
import { AllowAuthenticated } from '../../authorization/decorators/allow-authenticated.decorator';

@ApiTags('Handheld work sessions')
@Controller('api/mobile/v1/work-sessions')
@AllowAuthenticated()
export class WorkSessionController {
  constructor(private readonly handheld: HandheldService) {}

  @Post()
  @ApiOperation({ summary: 'Start an auditable handheld task session' })
  start(
    @Body() dto: CreateWorkSessionDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.handheld.startSession(
      request.user.userId,
      dto,
      request.correlationId ?? request.requestId,
    );
  }

  @Post(':id/pause')
  pause(@Param('id') id: string, @Req() request: AuthenticatedRequest) {
    return this.handheld.pauseSession(
      id,
      request.user.userId,
      request.correlationId ?? request.requestId,
    );
  }

  @Post(':id/resume')
  resume(@Param('id') id: string, @Req() request: AuthenticatedRequest) {
    return this.handheld.resumeSession(
      id,
      request.user.userId,
      request.correlationId ?? request.requestId,
    );
  }

  @Post(':id/complete')
  complete(@Param('id') id: string, @Req() request: AuthenticatedRequest) {
    return this.handheld.completeSession(
      id,
      request.user.userId,
      request.correlationId ?? request.requestId,
    );
  }

  @Get('active')
  active(@Req() request: AuthenticatedRequest) {
    return this.handheld.getActiveSessions(request.user.userId);
  }
}
