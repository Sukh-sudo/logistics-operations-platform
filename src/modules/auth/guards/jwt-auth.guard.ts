import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UserStatus } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/prisma/prisma.service';
import { accessTokenSecret } from '../auth.constants';
import type { AccessTokenPayload } from '../interfaces/authenticated-user.interface';
import type { AuthenticatedRequest } from '../interfaces/authenticated-request.interface';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext) {
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

    request.user = {
      userId: user.id,
      email: user.email,
      roles: user.snapshot.roleNames,
      permissions: user.snapshot.permissions,
      tokenVersion: user.tokenVersion,
    };
    return true;
  }
}
