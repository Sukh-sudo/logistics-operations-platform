import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  NotificationEventType,
  NotificationStatus,
  NotificationType,
  Prisma,
  ShipmentEventType,
} from '@prisma/client';
import { randomUUID } from 'crypto';

import { PrismaService } from '../../../infrastructure/prisma/prisma.service';
import { NotificationQueryDto } from '../dto/notification-query.dto';
import type { AuthenticatedUser } from '../../auth/interfaces/authenticated-user.interface';
import { PERMISSIONS } from '../../authorization/constants/permissions';

interface ShipmentNotificationSource {
  event: {
    id: string;
    eventType: ShipmentEventType;
    correlationId: string;
  };
  shipment: {
    id: string;
    shipmentNumber: string;
    referenceNumber: string | null;
    notificationRecipient: string | null;
  };
}

@Injectable()
export class NotificationService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Observes a committed shipment event and creates an in-app notification.
   * sourceEventId is unique, making retries safe for an eventually consistent
   * event consumer.
   */
  async createFromShipmentEvent(source: ShipmentNotificationSource) {
    const recipient = source.shipment.notificationRecipient
      ?.trim()
      .toLowerCase();
    const type = this.notificationType(source.event.eventType);

    // Shipments without an inbox and non-customer-facing events are ignored.
    if (!recipient || !type) {
      return null;
    }

    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.notification.findUnique({
        where: { sourceEventId: source.event.id },
        include: { snapshot: true },
      });
      if (existing) {
        return existing;
      }

      const notification = await tx.notification.create({
        data: {
          shipmentId: source.shipment.id,
          sourceEventId: source.event.id,
          type,
          recipient,
          payload: {
            shipmentNumber: source.shipment.shipmentNumber,
            referenceNumber: source.shipment.referenceNumber,
          },
        },
      });
      const event = await tx.notificationEvent.create({
        data: {
          notificationId: notification.id,
          eventType: NotificationEventType.NOTIFICATION_CREATED,
          correlationId: source.event.correlationId,
          payload: { sourceEventType: source.event.eventType },
        },
      });
      const snapshot = await tx.notificationSnapshot.create({
        data: {
          notificationId: notification.id,
          currentStatus: NotificationStatus.UNREAD,
          sentAt: event.createdAt,
          lastActivityAt: event.createdAt,
        },
      });

      return { ...notification, snapshot };
    });
  }

  getNotifications(
    query: NotificationQueryDto = {},
    actor: AuthenticatedUser,
  ) {
    const actorEmail = this.normalizedEmail(actor.email);
    const requestedRecipient = query.recipient
      ? this.normalizedEmail(query.recipient)
      : undefined;
    if (
      !this.canManageAll(actor) &&
      requestedRecipient &&
      requestedRecipient !== actorEmail
    ) {
      throw new ForbiddenException(
        'Notifications may only be listed for the authenticated recipient',
      );
    }

    return this.prisma.notification.findMany({
      // Recipient scoping happens in SQL, so unauthorized rows never enter
      // application memory or the response serializer.
      where: this.canManageAll(actor)
        ? requestedRecipient
          ? { recipient: requestedRecipient }
          : undefined
        : { recipient: actorEmail },
      include: { snapshot: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getNotification(id: string, actor: AuthenticatedUser) {
    const notification = await this.prisma.notification.findFirst({
      where: this.accessWhere(id, actor),
      include: {
        snapshot: true,
        events: { orderBy: { createdAt: 'asc' } },
      },
    });
    if (!notification) {
      throw new NotFoundException('Notification not found');
    }
    return notification;
  }

  async markRead(
    id: string,
    actor: AuthenticatedUser,
    requestId?: string,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const notification = await tx.notification.findFirst({
        where: this.accessWhere(id, actor),
        include: { snapshot: true },
      });
      if (!notification?.snapshot) {
        throw new NotFoundException('Notification not found');
      }
      if (notification.snapshot.currentStatus === NotificationStatus.READ) {
        return { notification, snapshot: notification.snapshot, event: null };
      }

      const event = await tx.notificationEvent.create({
        data: {
          notificationId: id,
          eventType: NotificationEventType.NOTIFICATION_READ,
          correlationId: requestId ?? randomUUID(),
          payload: { actorUserId: actor.userId },
        },
      });
      const snapshot = await tx.notificationSnapshot.update({
        where: { notificationId: id },
        data: {
          currentStatus: NotificationStatus.READ,
          readAt: event.createdAt,
          lastActivityAt: event.createdAt,
        },
      });
      return { notification, event, snapshot };
    });
  }

  async resend(
    id: string,
    actor: AuthenticatedUser,
    requestId?: string,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const notification = await tx.notification.findFirst({
        where: this.accessWhere(id, actor),
        include: { snapshot: true },
      });
      if (!notification?.snapshot) {
        throw new NotFoundException('Notification not found');
      }

      const event = await tx.notificationEvent.create({
        data: {
          notificationId: id,
          eventType: NotificationEventType.NOTIFICATION_RESEND_REQUESTED,
          correlationId: requestId ?? randomUUID(),
          payload: { actorUserId: actor.userId },
        },
      });
      const snapshot = await tx.notificationSnapshot.update({
        where: { notificationId: id },
        data: {
          currentStatus: NotificationStatus.UNREAD,
          deliveryAttempts: { increment: 1 },
          sentAt: event.createdAt,
          readAt: null,
          lastActivityAt: event.createdAt,
        },
      });
      return { notification, event, snapshot };
    });
  }

  private notificationType(
    eventType: ShipmentEventType,
  ): NotificationType | null {
    const customerEvents: Partial<
      Record<ShipmentEventType, NotificationType>
    > = {
      [ShipmentEventType.SHIPMENT_CREATED]:
        NotificationType.SHIPMENT_CREATED,
      [ShipmentEventType.SHIPMENT_OUT_FOR_DELIVERY]:
        NotificationType.OUT_FOR_DELIVERY,
      [ShipmentEventType.SHIPMENT_COMPLETED]: NotificationType.DELIVERED,
      [ShipmentEventType.SHIPMENT_CANCELLED]: NotificationType.EXCEPTION,
    };
    return customerEvents[eventType] ?? null;
  }

  private accessWhere(
    id: string,
    actor: AuthenticatedUser,
  ): Prisma.NotificationWhereInput {
    return this.canManageAll(actor)
      ? { id }
      : { id, recipient: this.normalizedEmail(actor.email) };
  }

  private canManageAll(actor: AuthenticatedUser) {
    return (
      actor.permissions.includes(PERMISSIONS.SYSTEM_ADMIN) ||
      actor.roles.some((role) =>
        ['ADMIN', 'ADMINISTRATOR'].includes(role.toUpperCase()),
      )
    );
  }

  private normalizedEmail(email: string) {
    return email.trim().toLowerCase();
  }
}
