import { UnauthorizedException } from '@nestjs/common';
import {
  HandheldDeviceEventType,
  HandheldDeviceStatus,
  UserEventType,
  UserStatus,
} from '@prisma/client';
import { createHash } from 'crypto';
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
    employeeNumber: 'EMP-1001',
    firstName: 'Taylor',
    lastName: 'Morgan',
    primaryTerminal: {
      id: 1,
      terminalCode: 'YYC',
      name: 'Calgary-000',
    },
    snapshot,
  };
  const tx = {
    user: { findUnique: jest.fn(), update: jest.fn() },
    refreshToken: {
      create: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    userEvent: { create: jest.fn() },
    userSnapshot: { update: jest.fn() },
    handheldDevice: { findUnique: jest.fn() },
    handheldDeviceEvent: { create: jest.fn() },
    handheldDeviceSnapshot: { update: jest.fn() },
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
    tx.handheldDevice.findUnique.mockResolvedValue({
      id: 'device-aggregate-1',
      credentialHash: createHash('sha256').update('d'.repeat(43)).digest('hex'),
      snapshot: { currentStatus: HandheldDeviceStatus.ACTIVE },
    });
    tx.handheldDeviceEvent.create.mockResolvedValue({ createdAt: new Date() });
    tx.refreshToken.updateMany.mockResolvedValue({ count: 1 });
  });

  it('logs in an active user and atomically persists the session, event, and snapshot', async () => {
    credentials.verifyPassword.mockResolvedValue(true);

    const result = await service.login({
      email: ' Operator@Example.com ',
      password: 'StrongPassword!1',
    });

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(jwt.signAsync).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'access' }),
      expect.objectContaining({
        algorithm: 'HS256',
        issuer: 'logistics-operations-platform',
        audience: 'logistics-platform-clients',
      }),
    );
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

  it('authenticates a matching badge and employee number for an online handheld bootstrap', async () => {
    const result = await service.loginHandheld({
      badgeBarcode: ' badge-1001 ',
      employeeId: ' emp-1001 ',
      deviceId: '8c808770-d3c8-4891-8382-f700e919aec3',
      deviceCredential: 'd'.repeat(43),
    });

    expect(tx.user.findUnique).toHaveBeenCalledWith({
      where: { badgeBarcode: 'BADGE-1001' },
      include: { snapshot: true, primaryTerminal: true },
    });
    expect(result).toMatchObject({
      accessToken: 'access-token',
      employee: { employeeNumber: 'EMP-1001' },
      terminal: { terminalCode: 'YYC' },
    });
    expect(tx.userEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        metadata: expect.objectContaining({ client: 'HANDHELD' }),
      }),
    });
    expect(tx.handheldDeviceEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        handheldDeviceId: 'device-aggregate-1',
        eventType: HandheldDeviceEventType.DEVICE_AUTHENTICATED,
      }),
    });
    expect(tx.refreshToken.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ handheldDeviceId: 'device-aggregate-1' }),
    });
  });

  it('rejects a handheld login from an unenrolled device', async () => {
    tx.handheldDevice.findUnique.mockResolvedValue(null);
    await expect(
      service.loginHandheld({
        badgeBarcode: 'BADGE-1001',
        employeeId: 'EMP-1001',
        deviceId: '8c808770-d3c8-4891-8382-f700e919aec3',
        deviceCredential: 'x'.repeat(43),
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
      handheldDeviceId: null,
      handheldDevice: null,
      familyId: 'family-1',
      rotatedAt: null,
      reuseDetectedAt: null,
    });

    await service.refresh('a'.repeat(64));

    expect(tx.refreshToken.updateMany).toHaveBeenCalledWith({
      where: { id: 'refresh-1', revokedAt: null },
      data: { revokedAt: expect.any(Date), rotatedAt: expect.any(Date) },
    });
    expect(tx.refreshToken.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ familyId: 'family-1' }),
    });
    expect(tx.userEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        eventType: UserEventType.REFRESH_TOKEN_ROTATED,
      }),
    });
  });

  it('revokes a token family and invalidates access tokens when a rotated token is replayed', async () => {
    tx.refreshToken.findUnique.mockResolvedValue({
      id: 'refresh-1',
      revokedAt: new Date(),
      rotatedAt: new Date(),
      reuseDetectedAt: null,
      expiresAt: new Date(Date.now() + 60_000),
      familyId: 'family-1',
      user,
      handheldDeviceId: null,
      handheldDevice: null,
    });
    tx.refreshToken.updateMany
      .mockResolvedValueOnce({ count: 2 })
      .mockResolvedValueOnce({ count: 1 });

    await expect(service.refresh('a'.repeat(64))).rejects.toBeInstanceOf(
      UnauthorizedException,
    );

    expect(tx.refreshToken.updateMany).toHaveBeenNthCalledWith(1, {
      where: { familyId: 'family-1', reuseDetectedAt: null },
      data: { reuseDetectedAt: expect.any(Date) },
    });
    expect(tx.refreshToken.updateMany).toHaveBeenNthCalledWith(2, {
      where: { familyId: 'family-1', revokedAt: null },
      data: { revokedAt: expect.any(Date) },
    });
    expect(tx.user.update).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      data: { tokenVersion: { increment: 1 } },
    });
    expect(tx.userEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        eventType: UserEventType.REFRESH_TOKEN_REUSE_DETECTED,
      }),
    });
    expect(tx.userSnapshot.update).toHaveBeenCalledWith({
      where: { userId: 'user-1' },
      data: { lastActivityAt: expect.any(Date) },
    });
  });
});
