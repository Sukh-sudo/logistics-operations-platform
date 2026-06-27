import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { AuthenticatedRequest } from '../../auth/interfaces/authenticated-request.interface';
import { PERMISSIONS_KEY } from '../decorators/permissions.decorator';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext) {
    const required = this.reflector.getAllAndOverride<string[]>(
      PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!required?.length) {
      throw new ForbiddenException('No permission requirement is declared');
    }
    const user = context.switchToHttp().getRequest<AuthenticatedRequest>().user;
    if (
      user.roles.some((role) => role.toUpperCase() === 'ADMINISTRATOR') ||
      required.every((permission) => user.permissions.includes(permission))
    ) {
      return true;
    }
    throw new ForbiddenException('Required permission is missing');
  }
}
