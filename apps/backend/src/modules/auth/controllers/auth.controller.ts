import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Headers,
  Post,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { ChangePasswordDto } from '../dto/change-password.dto';
import { LoginDto } from '../dto/login.dto';
import { LogoutDto, RefreshTokenDto } from '../dto/refresh-token.dto';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import type { AuthenticatedRequest } from '../interfaces/authenticated-request.interface';
import { Public } from '../decorators/public.decorator';
import { AuthService } from '../services/auth.service';
import { AllowAuthenticated } from '../../authorization/decorators/allow-authenticated.decorator';
import type { RequestWithId } from '../../../common/middleware/request-id.middleware';
import { REFRESH_TOKEN_TTL_MS } from '../auth.constants';

@Controller('auth')
@AllowAuthenticated()
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  @Public()
  login(@Body() dto: LoginDto, @Req() request: AuthenticatedRequest) {
    return this.authService.login(dto, request.correlationId ?? request.requestId);
  }

  @Post('web/login')
  @Public()
  async webLogin(
    @Body() dto: LoginDto,
    @Headers('x-csrf-protection') csrfProtection: string | undefined,
    @Req() request: RequestWithId,
    @Res({ passthrough: true }) response: Response,
  ) {
    this.requireCsrfHeader(csrfProtection);
    const issued = await this.authService.login(
      dto,
      request.correlationId ?? request.requestId,
    );
    this.setRefreshCookie(response, issued.refreshToken);
    return this.accessResponse(issued);
  }

  @Post('web/refresh')
  @Public()
  async webRefresh(
    @Headers('x-csrf-protection') csrfProtection: string | undefined,
    @Req() request: RequestWithId,
    @Res({ passthrough: true }) response: Response,
  ) {
    this.requireCsrfHeader(csrfProtection);
    const issued = await this.authService.refresh(
      this.refreshCookie(request),
      request.correlationId ?? request.requestId,
    );
    this.setRefreshCookie(response, issued.refreshToken);
    return this.accessResponse(issued);
  }

  @Post('refresh')
  @Public()
  refresh(@Body() dto: RefreshTokenDto, @Req() request: AuthenticatedRequest) {
    return this.authService.refresh(dto.refreshToken, request.correlationId ?? request.requestId);
  }

  @UseGuards(JwtAuthGuard)
  @Post('logout')
  logout(@Body() dto: LogoutDto, @Req() request: AuthenticatedRequest) {
    return this.authService.logout(
      request.user.userId,
      dto.refreshToken,
      request.correlationId ?? request.requestId,
    );
  }

  @UseGuards(JwtAuthGuard)
  @Post('web/logout')
  async webLogout(
    @Headers('x-csrf-protection') csrfProtection: string | undefined,
    @Req() request: AuthenticatedRequest,
    @Res({ passthrough: true }) response: Response,
  ) {
    this.requireCsrfHeader(csrfProtection);
    const result = await this.authService.logout(
      request.user.userId,
      this.refreshCookie(request),
      request.correlationId ?? request.requestId,
    );
    response.clearCookie(this.cookieName(), this.cookieOptions());
    return result;
  }

  @UseGuards(JwtAuthGuard)
  @Post('change-password')
  changePassword(
    @Body() dto: ChangePasswordDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.authService.changePassword(
      request.user.userId,
      dto,
      request.correlationId ?? request.requestId,
    );
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  me(@Req() request: AuthenticatedRequest) {
    return this.authService.getCurrentUser(request.user.userId);
  }

  private requireCsrfHeader(value?: string) {
    // Cross-origin forms cannot set this custom header; SameSite=Strict adds a
    // second browser-enforced boundary for cookie-authenticated endpoints.
    if (value !== '1') {
      throw new ForbiddenException('CSRF protection header is required');
    }
  }

  private refreshCookie(request: RequestWithId) {
    const cookies = new Map<string, string>();
    for (const entry of (request.headers.cookie ?? '').split(';')) {
      const separator = entry.indexOf('=');
      if (separator < 0) continue;
      try {
        cookies.set(
          entry.slice(0, separator).trim(),
          decodeURIComponent(entry.slice(separator + 1)),
        );
      } catch {
        throw new UnauthorizedException('Refresh cookie is invalid');
      }
    }
    const token = cookies.get(this.cookieName()) ?? cookies.get('refresh_token');
    if (!token) throw new UnauthorizedException('Refresh cookie is required');
    return token;
  }

  private setRefreshCookie(response: Response, refreshToken: string) {
    response.cookie(this.cookieName(), refreshToken, {
      ...this.cookieOptions(),
      maxAge: REFRESH_TOKEN_TTL_MS,
    });
  }

  private cookieName() {
    return process.env.NODE_ENV === 'production'
      ? '__Host-refresh_token'
      : 'refresh_token';
  }

  private cookieOptions() {
    return {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict' as const,
      path: '/',
    };
  }

  private accessResponse<T extends { refreshToken: string }>(issued: T) {
    const { refreshToken: _refreshToken, ...accessResponse } = issued;
    return accessResponse;
  }
}
