import { UnauthorizedException } from '@nestjs/common';
import type { ExecutionContext } from '@nestjs/common';
import { UserStatus } from '@prisma/client';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';

describe('JwtAuthGuard', () => {
  const request = { headers: { authorization: 'Bearer valid-token' } };
  const context = {
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
  const jwt = { verifyAsync: jest.fn() };
  const prisma = { user: { findUnique: jest.fn() } };

  beforeEach(() => jest.clearAllMocks());

  it('attaches current snapshot access to an authenticated request', async () => {
    jwt.verifyAsync.mockResolvedValue({
      sub: 'user-1',
      type: 'access',
      tokenVersion: 1,
    });
    prisma.user.findUnique.mockResolvedValue({
      id: 'user-1',
      email: 'operator@example.com',
      tokenVersion: 1,
      snapshot: {
        currentStatus: UserStatus.ACTIVE,
        roleNames: ['DISPATCHER'],
        permissions: ['trailer.depart'],
      },
    });

    await expect(
      new JwtAuthGuard(jwt as never, prisma as never).canActivate(context),
    ).resolves.toBe(true);
    expect((request as never as { user: { roles: string[] } }).user.roles).toEqual([
      'DISPATCHER',
    ]);
  });

  it('rejects a token whose version has been invalidated', async () => {
    jwt.verifyAsync.mockResolvedValue({
      sub: 'user-1',
      type: 'access',
      tokenVersion: 1,
    });
    prisma.user.findUnique.mockResolvedValue({
      tokenVersion: 2,
      snapshot: { currentStatus: UserStatus.ACTIVE },
    });

    await expect(
      new JwtAuthGuard(jwt as never, prisma as never).canActivate(context),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
