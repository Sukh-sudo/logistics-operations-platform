import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { ChangePasswordDto } from '../dto/change-password.dto';
import { LoginDto } from '../dto/login.dto';
import { LogoutDto, RefreshTokenDto } from '../dto/refresh-token.dto';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import type { AuthenticatedRequest } from '../interfaces/authenticated-request.interface';
import { AuthService } from '../services/auth.service';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  login(@Body() dto: LoginDto, @Req() request: AuthenticatedRequest) {
    return this.authService.login(dto, request.requestId);
  }

  @Post('refresh')
  refresh(@Body() dto: RefreshTokenDto, @Req() request: AuthenticatedRequest) {
    return this.authService.refresh(dto.refreshToken, request.requestId);
  }

  @UseGuards(JwtAuthGuard)
  @Post('logout')
  logout(@Body() dto: LogoutDto, @Req() request: AuthenticatedRequest) {
    return this.authService.logout(
      request.user.userId,
      dto.refreshToken,
      request.requestId,
    );
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
      request.requestId,
    );
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  me(@Req() request: AuthenticatedRequest) {
    return this.authService.getCurrentUser(request.user.userId);
  }
}
