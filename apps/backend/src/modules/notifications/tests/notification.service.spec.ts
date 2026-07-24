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
      findUnique: jest.fn(),
    },
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
});
