import { ForbiddenException } from '@nestjs/common';
import type { ExecutionContext } from '@nestjs/common';
import { PermissionsGuard } from '../guards/permissions.guard';
import { RolesGuard } from '../guards/roles.guard';
import { IS_PUBLIC_KEY } from '../../auth/decorators/public.decorator';
import { ALLOW_AUTHENTICATED_KEY } from '../decorators/allow-authenticated.decorator';
import { PERMISSIONS_KEY } from '../decorators/permissions.decorator';

describe('Authorization guards', () => {
  const user = {
    roles: ['DISPATCHER', 'VIEWER'],
    permissions: ['package.view', 'trailer.depart'],
  };
  const context = {
    getHandler: jest.fn(),
    getClass: jest.fn(),
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
  } as unknown as ExecutionContext;
  const reflector = { getAllAndOverride: jest.fn() };

  beforeEach(() => jest.clearAllMocks());

  const permissionPolicy = (permissions?: string[], allowAuthenticated = false) => {
    reflector.getAllAndOverride.mockImplementation((key: string) => {
      if (key === IS_PUBLIC_KEY) return false;
      if (key === ALLOW_AUTHENTICATED_KEY) return allowAuthenticated;
      if (key === PERMISSIONS_KEY) return permissions;
      return undefined;
    });
  };

  it('accepts any one of multiple required roles', () => {
    reflector.getAllAndOverride.mockReturnValue(['SUPERVISOR', 'DISPATCHER']);
    expect(new RolesGuard(reflector as never).canActivate(context)).toBe(true);
  });

  it('requires every declared permission', () => {
    permissionPolicy([
      'package.view',
      'trailer.depart',
    ]);
    expect(new PermissionsGuard(reflector as never).canActivate(context)).toBe(
      true,
    );
  });

  it('denies access when a required permission is missing', () => {
    permissionPolicy(['user.manage']);
    expect(() =>
      new PermissionsGuard(reflector as never).canActivate(context),
    ).toThrow(ForbiddenException);
  });

  it('denies access by default when requirements are undeclared', () => {
    reflector.getAllAndOverride.mockReturnValue(undefined);
    expect(() => new RolesGuard(reflector as never).canActivate(context)).toThrow(
      ForbiddenException,
    );
  });

  it('allows the administrator override', () => {
    const administratorContext = {
      ...context,
      switchToHttp: () => ({
        getRequest: () => ({ user: { roles: ['ADMIN'], permissions: [] } }),
      }),
    } as unknown as ExecutionContext;
    permissionPolicy(['system.admin']);
    expect(
      new PermissionsGuard(reflector as never).canActivate(administratorContext),
    ).toBe(true);
  });

  it('uses the system administrator permission as the canonical override', () => {
    const administratorContext = {
      ...context,
      switchToHttp: () => ({
        getRequest: () => ({
          user: { roles: ['INTEGRATION_ADMIN'], permissions: ['system.admin'] },
        }),
      }),
    } as unknown as ExecutionContext;
    permissionPolicy(['terminal.manage']);

    expect(
      new PermissionsGuard(reflector as never).canActivate(administratorContext),
    ).toBe(true);
  });

  it('allows an explicitly authenticated self-service route', () => {
    permissionPolicy(undefined, true);
    expect(new PermissionsGuard(reflector as never).canActivate(context)).toBe(
      true,
    );
  });

  it('denies authenticated routes with no explicit authorization policy', () => {
    permissionPolicy(undefined);
    expect(() =>
      new PermissionsGuard(reflector as never).canActivate(context),
    ).toThrow(ForbiddenException);
  });
});
