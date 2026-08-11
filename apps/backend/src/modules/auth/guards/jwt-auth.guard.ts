import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Reflector } from '@nestjs/core';
import { HandheldDeviceStatus, UserStatus } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/prisma/prisma.service';
import { accessTokenSecret } from '../auth.constants';
import type { AccessTokenPayload } from '../interfaces/authenticated-user.interface';
import type { AuthenticatedRequest } from '../interfaces/authenticated-request.interface';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext) {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const [scheme, token] = request.headers.authorization?.split(' ') ?? [];
    if (scheme !== 'Bearer' || !token) {
      throw new UnauthorizedException('Bearer token is required');
    }

    let payload: AccessTokenPayload;
    try {
      payload = await this.jwtService.verifyAsync<AccessTokenPayload>(token, {
        secret: accessTokenSecret(),
      });
    } catch {
      throw new UnauthorizedException('Invalid access token');
    }
    if (payload.type !== 'access' || !payload.sub) {
      throw new UnauthorizedException('Invalid access token');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      include: { snapshot: true },
    });
    if (
      !user?.snapshot ||
      user.snapshot.currentStatus !== UserStatus.ACTIVE ||
      user.tokenVersion !== payload.tokenVersion
    ) {
      throw new UnauthorizedException('Session is no longer valid');
    }
    if (payload.handheldDeviceId) {
      const device = await this.prisma.handheldDeviceSnapshot.findUnique({
        where: { id: payload.handheldDeviceId },
      });
      if (device?.currentStatus !== HandheldDeviceStatus.ACTIVE) {
        throw new UnauthorizedException('Device session is no longer valid');
      }
    }

    request.user = {
      userId: user.id,
      email: user.email,
      roles: user.snapshot.roleNames,
      permissions: user.snapshot.permissions,
      tokenVersion: user.tokenVersion,
      ...(payload.handheldDeviceId && {
        handheldDeviceId: payload.handheldDeviceId,
      }),
    };
    return true;
  }
}
