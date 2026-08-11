import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { AuthenticatedRequest } from '../../auth/interfaces/authenticated-request.interface';
import { IS_PUBLIC_KEY } from '../../auth/decorators/public.decorator';
import { ALLOW_AUTHENTICATED_KEY } from '../decorators/allow-authenticated.decorator';
import { PERMISSIONS_KEY } from '../decorators/permissions.decorator';
import { PERMISSIONS } from '../constants/permissions';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext) {
    // Public routes have already been explicitly exempted from JWT checks.
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    // Self-service and aggregate-owner routes must opt in explicitly.
    const allowAuthenticated = this.reflector.getAllAndOverride<boolean>(
      ALLOW_AUTHENTICATED_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (allowAuthenticated) return true;

    const required = this.reflector.getAllAndOverride<string[]>(
      PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!required?.length) {
      throw new ForbiddenException('No permission requirement is declared');
    }
    const user = context.switchToHttp().getRequest<AuthenticatedRequest>().user;
    if (
      user.roles.some((role) =>
        ['ADMIN', 'ADMINISTRATOR'].includes(role.toUpperCase()),
      ) ||
      user.permissions.includes(PERMISSIONS.SYSTEM_ADMIN) ||
      required.every((permission) => user.permissions.includes(permission))
    ) {
      return true;
    }
    throw new ForbiddenException('Required permission is missing');
  }
}
