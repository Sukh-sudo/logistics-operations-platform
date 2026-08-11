import { Body, Controller, Get, Param, Post, Query, Req } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { AuthenticatedRequest } from '../../auth/interfaces/authenticated-request.interface';
import { HandheldScanDto } from '../dto/handheld-scan.dto';
import { HandheldSyncDto } from '../dto/sync.dto';
import { HandheldService } from '../services/handheld.service';
import { AllowAuthenticated } from '../../authorization/decorators/allow-authenticated.decorator';

@ApiTags('Handheld scans')
@Controller('api/mobile/v1')
@AllowAuthenticated()
export class HandheldScanController {
  constructor(private readonly handheld: HandheldService) {}

  @Post('work-sessions/:sessionId/scans')
  @ApiOperation({ summary: 'Process one idempotent online scan command' })
  scan(
    @Param('sessionId') sessionId: string,
    @Body() dto: HandheldScanDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.handheld.processScan(sessionId, request.user.userId, dto);
  }

  @Post('work-sessions/:sessionId/sync')
  @ApiOperation({ summary: 'Synchronize an ordered offline command batch' })
  sync(
    @Param('sessionId') sessionId: string,
    @Body() dto: HandheldSyncDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.handheld.synchronize(sessionId, request.user.userId, dto);
  }

  @Get('work-sessions/:sessionId/sync/status')
  syncStatus(
    @Param('sessionId') sessionId: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.handheld.getSyncStatus(sessionId, request.user.userId);
  }

  @Post('work-sessions/:sessionId/events/:eventId/reverse')
  @ApiOperation({ summary: 'Create a compensating event for an accepted scan' })
  reverse(
    @Param('sessionId') sessionId: string,
    @Param('eventId') eventId: string,
    @Body() dto: HandheldScanDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.handheld.reverse(
      eventId,
      sessionId,
      request.user.userId,
      dto,
    );
  }
  @Post('scans')
  @ApiOperation({ summary: 'Process one idempotent online scan command' })
  documentedScan(
    @Body() dto: HandheldScanDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.handheld.processScan(
      dto.taskSessionId,
      request.user.userId,
      dto,
    );
  }

  @Post('sync')
  @ApiOperation({ summary: 'Synchronize an ordered offline command batch' })
  documentedSync(
    @Body() dto: HandheldSyncDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.handheld.synchronize(
      dto.taskSessionId,
      request.user.userId,
      dto,
    );
  }

  @Get('sync/status')
  documentedSyncStatus(
    @Query('taskSessionId') taskSessionId: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.handheld.getSyncStatus(
      taskSessionId,
      request.user.userId,
    );
  }

  @Post('events/:eventId/reverse')
  @ApiOperation({ summary: 'Create a compensating event for an accepted scan' })
  documentedReverse(
    @Param('eventId') eventId: string,
    @Body() dto: HandheldScanDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.handheld.reverse(
      eventId,
      dto.taskSessionId,
      request.user.userId,
      dto,
    );
  }
}
