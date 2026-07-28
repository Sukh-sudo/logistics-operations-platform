import { Body, Controller, Get, Post, Req } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../../auth/decorators/public.decorator';
import type { AuthenticatedRequest } from '../../auth/interfaces/authenticated-request.interface';
import { LogoutDto, RefreshTokenDto } from '../../auth/dto/refresh-token.dto';
import { AuthService } from '../../auth/services/auth.service';
import { HandheldLoginDto } from '../dto/handheld-login.dto';
import { HandheldService } from '../services/handheld.service';

@ApiTags('Handheld')
@Controller('api/mobile/v1')
export class HandheldAuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly handheld: HandheldService,
  ) {}

  @Public()
  @Post('auth/login')
  @ApiOperation({ summary: 'Authenticate a handheld employee online' })
  login(@Body() dto: HandheldLoginDto, @Req() request: AuthenticatedRequest) {
    return this.auth.loginHandheld(
      dto,
      request.correlationId ?? request.requestId,
    );
  }

  @Public()
  @Post('auth/refresh')
  refresh(@Body() dto: RefreshTokenDto, @Req() request: AuthenticatedRequest) {
    return this.auth.refresh(
      dto.refreshToken,
      request.correlationId ?? request.requestId,
    );
  }

  @Post('auth/logout')
  logout(@Body() dto: LogoutDto, @Req() request: AuthenticatedRequest) {
    return this.auth.logout(
      request.user.userId,
      dto.refreshToken,
      request.correlationId ?? request.requestId,
    );
  }

  @Get('bootstrap')
  @ApiOperation({ summary: 'Load employee, terminal, task, and device configuration' })
  bootstrap(@Req() request: AuthenticatedRequest) {
    return this.handheld.bootstrap(request.user.userId);
  }
}
