import { ConflictException, NotFoundException } from '@nestjs/common';
import {
  HandheldDeviceEventType,
  HandheldDevicePlatform,
  HandheldDeviceStatus,
} from '@prisma/client';
import { HandheldDeviceService } from '../services/handheld-device.service';

describe('HandheldDeviceService', () => {
  const createdAt = new Date('2026-08-11T12:00:00.000Z');
  const tx = {
    handheldDevice: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    handheldDeviceEvent: { create: jest.fn() },
    handheldDeviceSnapshot: { create: jest.fn(), update: jest.fn() },
    refreshToken: { updateMany: jest.fn() },
  };
  const prisma = {
    $transaction: jest.fn((callback) => callback(tx)),
    handheldDeviceSnapshot: { findMany: jest.fn() },
  };
  let service: HandheldDeviceService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new HandheldDeviceService(prisma as never);
    tx.handheldDeviceEvent.create.mockResolvedValue({ createdAt });
  });

  it('atomically enrolls a device and returns a credential only once', async () => {
    tx.handheldDevice.findUnique.mockResolvedValue(null);
    tx.handheldDevice.create.mockResolvedValue({
      id: 'device-1',
      deviceId: '8c808770-d3c8-4891-8382-f700e919aec3',
    });
    tx.handheldDeviceSnapshot.create.mockResolvedValue({
      id: 'device-1',
      currentStatus: HandheldDeviceStatus.ACTIVE,
    });

    const result = await service.enroll(
      {
        deviceId: '8c808770-d3c8-4891-8382-f700e919aec3',
        displayName: ' Dock 12 ',
        platform: HandheldDevicePlatform.ANDROID,
      },
      'admin-1',
      'correlation-1',
    );

    expect(result.credential).toHaveLength(43);
    expect(tx.handheldDevice.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        credentialHash: expect.stringMatching(/^[a-f0-9]{64}$/),
      }),
    });
    expect(tx.handheldDeviceEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        eventType: HandheldDeviceEventType.DEVICE_ENROLLED,
        payload: { displayName: 'Dock 12', platform: HandheldDevicePlatform.ANDROID },
      }),
    });
    expect(tx.handheldDeviceSnapshot.create).toHaveBeenCalled();
  });

  it('does not replace an active device credential', async () => {
    tx.handheldDevice.findUnique.mockResolvedValue({
      snapshot: { currentStatus: HandheldDeviceStatus.ACTIVE },
    });
    await expect(
      service.enroll(
        {
          deviceId: '8c808770-d3c8-4891-8382-f700e919aec3',
          displayName: 'Dock 12',
          platform: HandheldDevicePlatform.ANDROID,
        },
        'admin-1',
      ),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('revokes a device and every bound refresh token transactionally', async () => {
    tx.handheldDevice.findUnique.mockResolvedValue({
      id: 'device-1',
      snapshot: { currentStatus: HandheldDeviceStatus.ACTIVE },
    });
    tx.handheldDeviceSnapshot.update.mockResolvedValue({
      id: 'device-1',
      currentStatus: HandheldDeviceStatus.REVOKED,
    });

    await service.revoke('device-1', 'admin-1', 'correlation-1');

    expect(tx.handheldDeviceEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ eventType: HandheldDeviceEventType.DEVICE_REVOKED }),
    });
    expect(tx.refreshToken.updateMany).toHaveBeenCalledWith({
      where: { handheldDeviceId: 'device-1', revokedAt: null },
      data: { revokedAt: createdAt },
    });
  });

  it('rejects revocation of an unknown device', async () => {
    tx.handheldDevice.findUnique.mockResolvedValue(null);
    await expect(service.revoke('missing', 'admin-1')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
