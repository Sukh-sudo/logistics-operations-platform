import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { AuthenticatedRequest } from '../../auth/interfaces/authenticated-request.interface';
import { ROLES_KEY } from '../decorators/roles.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext) {
    const required = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required?.length) {
      throw new ForbiddenException('No role requirement is declared');
    }
    const { roles } = context
      .switchToHttp()
      .getRequest<AuthenticatedRequest>().user;
    const normalized = roles.map((role) => role.toUpperCase());
    if (
      normalized.includes('ADMINISTRATOR') ||
      required.some((role) => normalized.includes(role.toUpperCase()))
    ) {
      return true;
    }
    throw new ForbiddenException('Required role is missing');
  }
}
