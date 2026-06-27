import { ForbiddenException } from '@nestjs/common';
import type { ExecutionContext } from '@nestjs/common';
import { PermissionsGuard } from '../guards/permissions.guard';
import { RolesGuard } from '../guards/roles.guard';

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

  it('accepts any one of multiple required roles', () => {
    reflector.getAllAndOverride.mockReturnValue(['SUPERVISOR', 'DISPATCHER']);
    expect(new RolesGuard(reflector as never).canActivate(context)).toBe(true);
  });

  it('requires every declared permission', () => {
    reflector.getAllAndOverride.mockReturnValue([
      'package.view',
      'trailer.depart',
    ]);
    expect(new PermissionsGuard(reflector as never).canActivate(context)).toBe(
      true,
    );
  });

  it('denies access when a required permission is missing', () => {
    reflector.getAllAndOverride.mockReturnValue(['user.manage']);
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
        getRequest: () => ({ user: { roles: ['ADMINISTRATOR'], permissions: [] } }),
      }),
    } as unknown as ExecutionContext;
    reflector.getAllAndOverride.mockReturnValue(['system.admin']);
    expect(
      new PermissionsGuard(reflector as never).canActivate(administratorContext),
    ).toBe(true);
  });
});
