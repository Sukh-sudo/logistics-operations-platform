import { UnauthorizedException } from '@nestjs/common';
import { UserEventType, UserStatus } from '@prisma/client';
import { AuthService } from '../services/auth.service';

describe('AuthService', () => {
  const snapshot = {
    currentStatus: UserStatus.ACTIVE,
    roleNames: ['DISPATCHER'],
    permissions: ['trailer.depart'],
  };
  const user = {
    id: 'user-1',
    email: 'operator@example.com',
    passwordHash: 'password-hash',
    tokenVersion: 2,
    snapshot,
  };
  const tx = {
    user: { findUnique: jest.fn() },
    refreshToken: {
      create: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    userEvent: { create: jest.fn() },
    userSnapshot: { update: jest.fn() },
  };
  const prisma = { $transaction: jest.fn((callback) => callback(tx)) };
  const jwt = { signAsync: jest.fn().mockResolvedValue('access-token') };
  const credentials = {
    verifyPassword: jest.fn(),
    hashPassword: jest.fn(),
  };
  let service: AuthService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new AuthService(prisma as never, jwt as never, credentials as never);
    tx.user.findUnique.mockResolvedValue(user);
    tx.userEvent.create.mockResolvedValue({ createdAt: new Date() });
  });

  it('logs in an active user and atomically persists the session, event, and snapshot', async () => {
    credentials.verifyPassword.mockResolvedValue(true);

    const result = await service.login({
      email: ' Operator@Example.com ',
      password: 'StrongPassword!1',
    });

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(tx.refreshToken.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: 'user-1',
        tokenHash: expect.not.stringContaining('StrongPassword'),
      }),
    });
    expect(tx.userEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        eventType: UserEventType.USER_AUTHENTICATED,
      }),
    });
    expect(tx.userSnapshot.update).toHaveBeenCalledWith({
      where: { userId: 'user-1' },
      data: expect.objectContaining({
        lastLoginAt: expect.any(Date),
        lastActivityAt: expect.any(Date),
      }),
    });
    expect(result).toMatchObject({
      accessToken: 'access-token',
      tokenType: 'Bearer',
      expiresIn: 900,
    });
  });

  it('does not reveal whether the email or password was invalid', async () => {
    tx.user.findUnique.mockResolvedValue(user);
    credentials.verifyPassword.mockResolvedValue(false);

    await expect(
      service.login({
        email: user.email,
        password: 'WrongPassword!1',
      }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(tx.refreshToken.create).not.toHaveBeenCalled();
  });

  it('rotates a valid refresh token and records the event atomically', async () => {
    tx.refreshToken.findUnique.mockResolvedValue({
      id: 'refresh-1',
      revokedAt: null,
      expiresAt: new Date(Date.now() + 60_000),
      user,
    });

    await service.refresh('a'.repeat(64));

    expect(tx.refreshToken.update).toHaveBeenCalledWith({
      where: { id: 'refresh-1' },
      data: { revokedAt: expect.any(Date) },
    });
    expect(tx.refreshToken.create).toHaveBeenCalledTimes(1);
    expect(tx.userEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        eventType: UserEventType.REFRESH_TOKEN_ROTATED,
      }),
    });
  });
});
