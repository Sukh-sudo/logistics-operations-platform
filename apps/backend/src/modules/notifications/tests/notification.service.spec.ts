import {
  NotificationEventType,
  NotificationStatus,
  NotificationType,
  ShipmentEventType,
} from '@prisma/client';

import { NotificationService } from '../services/notification.service';

describe('NotificationService', () => {
  const tx = {
    notification: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
    },
    notificationEvent: { create: jest.fn() },
    notificationSnapshot: {
      create: jest.fn(),
      update: jest.fn(),
    },
  };
  const prisma = {
    $transaction: jest.fn((callback) => callback(tx)),
    notification: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
    },
  };
  const recipient = {
    userId: 'customer-1',
    email: 'Customer@Example.com',
    roles: ['CUSTOMER'],
    permissions: [],
    tokenVersion: 0,
  };
  const administrator = {
    userId: 'admin-1',
    email: 'admin@example.com',
    roles: [],
    permissions: ['system.admin'],
    tokenVersion: 0,
  };
  let service: NotificationService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new NotificationService(prisma as never);
  });

  it('creates an idempotent notification event and snapshot', async () => {
    const createdAt = new Date();
    tx.notification.findUnique.mockResolvedValue(null);
    tx.notification.create.mockResolvedValue({
      id: 'n1',
      type: NotificationType.OUT_FOR_DELIVERY,
    });
    tx.notificationEvent.create.mockResolvedValue({
      id: 'ne1',
      createdAt,
    });
    tx.notificationSnapshot.create.mockResolvedValue({
      currentStatus: NotificationStatus.UNREAD,
      sentAt: createdAt,
    });

    const result = await service.createFromShipmentEvent({
      shipment: {
        id: 's1',
        shipmentNumber: 'SHIP-1',
        referenceNumber: 'ORDER-1',
        notificationRecipient: 'Customer@Example.com',
      },
      event: {
        id: 'se1',
        eventType: ShipmentEventType.SHIPMENT_OUT_FOR_DELIVERY,
        correlationId: 'request-1',
      },
    });

    expect(tx.notification.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        sourceEventId: 'se1',
        recipient: 'customer@example.com',
        type: NotificationType.OUT_FOR_DELIVERY,
      }),
    });
    expect(tx.notificationEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        eventType: NotificationEventType.NOTIFICATION_CREATED,
      }),
    });
    expect(result?.snapshot.currentStatus).toBe(NotificationStatus.UNREAD);
  });

  it('ignores shipment events that are not customer-facing', async () => {
    const result = await service.createFromShipmentEvent({
      shipment: {
        id: 's1',
        shipmentNumber: 'SHIP-1',
        referenceNumber: null,
        notificationRecipient: 'customer@example.com',
      },
      event: {
        id: 'se1',
        eventType: ShipmentEventType.SHIPMENT_PROGRESS_UPDATED,
        correlationId: 'request-1',
      },
    });

    expect(result).toBeNull();
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('returns the existing notification when the source event is replayed', async () => {
    const existing = {
      id: 'n1',
      sourceEventId: 'se1',
      snapshot: { currentStatus: NotificationStatus.UNREAD },
    };
    tx.notification.findUnique.mockResolvedValue(existing);

    const result = await service.createFromShipmentEvent({
      shipment: {
        id: 's1',
        shipmentNumber: 'SHIP-1',
        referenceNumber: null,
        notificationRecipient: 'customer@example.com',
      },
      event: {
        id: 'se1',
        eventType: ShipmentEventType.SHIPMENT_COMPLETED,
        correlationId: 'request-1',
      },
    });

    expect(result).toBe(existing);
    expect(tx.notification.create).not.toHaveBeenCalled();
    expect(tx.notificationEvent.create).not.toHaveBeenCalled();
    expect(tx.notificationSnapshot.create).not.toHaveBeenCalled();
  });

  it('scopes collection reads to the authenticated recipient', async () => {
    prisma.notification.findMany.mockResolvedValue([]);

    await service.getNotifications({}, recipient);

    expect(prisma.notification.findMany).toHaveBeenCalledWith({
      where: { recipient: 'customer@example.com' },
      include: { snapshot: true },
      orderBy: { createdAt: 'desc' },
    });
  });

  it('rejects another recipient filter but permits administrator filtering', async () => {
    expect(() =>
      service.getNotifications({ recipient: 'other@example.com' }, recipient),
    ).toThrow('Notifications may only be listed');

    await service.getNotifications(
      { recipient: 'Other@Example.com' },
      administrator,
    );
    expect(prisma.notification.findMany).toHaveBeenLastCalledWith(
      expect.objectContaining({ where: { recipient: 'other@example.com' } }),
    );
  });

  it('uses a recipient-scoped query for notification history', async () => {
    prisma.notification.findFirst.mockResolvedValue({ id: 'n1' });

    await service.getNotification('n1', recipient);

    expect(prisma.notification.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'n1', recipient: 'customer@example.com' },
      }),
    );
  });

  it('records a read event and updates the snapshot in one transaction', async () => {
    const readAt = new Date('2026-07-24T12:00:00.000Z');
    tx.notification.findFirst.mockResolvedValue({
      id: 'n1',
      recipient: 'customer@example.com',
      snapshot: { currentStatus: NotificationStatus.UNREAD },
    });
    tx.notificationEvent.create.mockResolvedValue({
      id: 'ne-read',
      createdAt: readAt,
    });
    tx.notificationSnapshot.update.mockResolvedValue({
      currentStatus: NotificationStatus.READ,
      readAt,
    });

    const result = await service.markRead('n1', recipient, 'request-read');

    expect(tx.notificationEvent.create).toHaveBeenCalledWith({
      data: {
        notificationId: 'n1',
        eventType: NotificationEventType.NOTIFICATION_READ,
        correlationId: 'request-read',
        payload: { actorUserId: 'customer-1' },
      },
    });
    expect(tx.notificationSnapshot.update).toHaveBeenCalledWith({
      where: { notificationId: 'n1' },
      data: {
        currentStatus: NotificationStatus.READ,
        readAt,
        lastActivityAt: readAt,
      },
    });
    expect(result.snapshot.currentStatus).toBe(NotificationStatus.READ);
  });

  it('records a resend event and resets the unread snapshot state', async () => {
    const resentAt = new Date('2026-07-24T13:00:00.000Z');
    tx.notification.findFirst.mockResolvedValue({
      id: 'n1',
      recipient: 'customer@example.com',
      snapshot: { currentStatus: NotificationStatus.READ },
    });
    tx.notificationEvent.create.mockResolvedValue({
      id: 'ne-resend',
      createdAt: resentAt,
    });
    tx.notificationSnapshot.update.mockResolvedValue({
      currentStatus: NotificationStatus.UNREAD,
      deliveryAttempts: 2,
    });

    const result = await service.resend('n1', recipient, 'request-resend');

    expect(tx.notificationEvent.create).toHaveBeenCalledWith({
      data: {
        notificationId: 'n1',
        eventType: NotificationEventType.NOTIFICATION_RESEND_REQUESTED,
        correlationId: 'request-resend',
        payload: { actorUserId: 'customer-1' },
      },
    });
    expect(tx.notificationSnapshot.update).toHaveBeenCalledWith({
      where: { notificationId: 'n1' },
      data: {
        currentStatus: NotificationStatus.UNREAD,
        deliveryAttempts: { increment: 1 },
        sentAt: resentAt,
        readAt: null,
        lastActivityAt: resentAt,
      },
    });
    expect(result.snapshot.currentStatus).toBe(NotificationStatus.UNREAD);
  });

  it('returns not found before writing when a notification is outside the recipient scope', async () => {
    tx.notification.findFirst.mockResolvedValue(null);

    await expect(service.markRead('other', recipient)).rejects.toThrow(
      'Notification not found',
    );
    expect(tx.notification.findFirst).toHaveBeenCalledWith({
      where: { id: 'other', recipient: 'customer@example.com' },
      include: { snapshot: true },
    });
    expect(tx.notificationEvent.create).not.toHaveBeenCalled();
    expect(tx.notificationSnapshot.update).not.toHaveBeenCalled();
  });
});
