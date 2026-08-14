import { INestApplication, ValidationPipe } from '@nestjs/common';
import {
  NotificationEventType,
  NotificationStatus,
  NotificationType,
  PrismaClient,
  UserStatus,
} from '@prisma/client';
import { Test, TestingModule } from '@nestjs/testing';
import { randomUUID } from 'crypto';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaExceptionFilter } from '../src/common/filters/prisma-exception.filter';
import { UserService } from '../src/modules/users/services/user.service';
import { createAuthenticatedAdmin } from './authenticated-admin.fixture';

const prisma = new PrismaClient();

describe('Notification object authorization (e2e)', () => {
  let app: INestApplication;
  let owner: { id: string; email: string; authorization: string };
  let outsider: { id: string; email: string; authorization: string };
  let administratorAuthorization: string;
  let ownerNotificationId: string;
  let outsiderNotificationId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    app.useGlobalFilters(new PrismaExceptionFilter());
    await app.init();

    owner = await createAuthenticatedUser('notification-owner');
    outsider = await createAuthenticatedUser('notification-outsider');
    administratorAuthorization = await createAuthenticatedAdmin(
      app,
      prisma,
      'notification-admin',
    );
    ownerNotificationId = await createNotification(owner.email);
    outsiderNotificationId = await createNotification(outsider.email);
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  it('scopes recipient reads and writes while preserving administrator access', async () => {
    const ownCollection = await request(app.getHttpServer())
      .get('/notifications')
      .set('Authorization', owner.authorization)
      .expect(200);
    expect(ownCollection.body.map(({ id }: { id: string }) => id)).toEqual([
      ownerNotificationId,
    ]);

    await request(app.getHttpServer())
      .get('/notifications')
      .query({ recipient: outsider.email })
      .set('Authorization', owner.authorization)
      .expect(403);
    await request(app.getHttpServer())
      .get(`/notifications/${outsiderNotificationId}`)
      .set('Authorization', owner.authorization)
      .expect(404);
    await request(app.getHttpServer())
      .patch(`/notifications/${outsiderNotificationId}/read`)
      .set('Authorization', owner.authorization)
      .expect(404);
    await request(app.getHttpServer())
      .post(`/notifications/${outsiderNotificationId}/resend`)
      .set('Authorization', owner.authorization)
      .expect(404);

    await request(app.getHttpServer())
      .get(`/notifications/${ownerNotificationId}`)
      .set('Authorization', owner.authorization)
      .expect(200);
    await request(app.getHttpServer())
      .patch(`/notifications/${ownerNotificationId}/read`)
      .set('Authorization', owner.authorization)
      .expect(200);
    await request(app.getHttpServer())
      .post(`/notifications/${ownerNotificationId}/resend`)
      .set('Authorization', owner.authorization)
      .expect(201);

    const administrativeCollection = await request(app.getHttpServer())
      .get('/notifications')
      .set('Authorization', administratorAuthorization)
      .expect(200);
    expect(
      administrativeCollection.body.map(({ id }: { id: string }) => id),
    ).toEqual(
      expect.arrayContaining([ownerNotificationId, outsiderNotificationId]),
    );
    await request(app.getHttpServer())
      .post(`/notifications/${outsiderNotificationId}/resend`)
      .set('Authorization', administratorAuthorization)
      .expect(201);

    const [ownerNotification, outsiderNotification] = await Promise.all([
      prisma.notification.findUniqueOrThrow({
        where: { id: ownerNotificationId },
        include: { snapshot: true, events: { orderBy: { createdAt: 'asc' } } },
      }),
      prisma.notification.findUniqueOrThrow({
        where: { id: outsiderNotificationId },
        include: { snapshot: true, events: { orderBy: { createdAt: 'asc' } } },
      }),
    ]);
    expect(ownerNotification.snapshot).toMatchObject({
      currentStatus: NotificationStatus.UNREAD,
      deliveryAttempts: 2,
    });
    expect(ownerNotification.events.map(({ eventType }) => eventType)).toEqual([
      NotificationEventType.NOTIFICATION_CREATED,
      NotificationEventType.NOTIFICATION_READ,
      NotificationEventType.NOTIFICATION_RESEND_REQUESTED,
    ]);
    expect(ownerNotification.events.slice(1).map(({ payload }) => payload)).toEqual([
      { actorUserId: owner.id },
      { actorUserId: owner.id },
    ]);
    // Failed cross-recipient commands did not append events; only the
    // administrator's explicit resend changed the outsider aggregate.
    expect(outsiderNotification.events.map(({ eventType }) => eventType)).toEqual([
      NotificationEventType.NOTIFICATION_CREATED,
      NotificationEventType.NOTIFICATION_RESEND_REQUESTED,
    ]);
  });

  async function createAuthenticatedUser(prefix: string) {
    const users = app.get(UserService);
    const suffix = `${Date.now().toString(36)}-${randomUUID().slice(0, 8)}`;
    const email = `${prefix}-${suffix}@example.com`;
    const password = 'NotificationOwner!1';
    const created = await users.createUser({
      employeeNumber: `${prefix}-${suffix}`,
      email,
      firstName: 'Notification',
      lastName: 'Recipient',
      password,
      status: UserStatus.ACTIVE,
    });
    const login = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email, password })
      .expect(201);
    return {
      id: created.user.id,
      email,
      authorization: `Bearer ${login.body.accessToken}`,
    };
  }

  function createNotification(recipient: string) {
    return prisma.$transaction(async (tx) => {
      const notification = await tx.notification.create({
        data: {
          sourceEventId: randomUUID(),
          type: NotificationType.SHIPMENT_CREATED,
          recipient,
          payload: { shipmentNumber: 'AUTHORIZATION-TEST' },
        },
      });
      const event = await tx.notificationEvent.create({
        data: {
          notificationId: notification.id,
          eventType: NotificationEventType.NOTIFICATION_CREATED,
          correlationId: randomUUID(),
        },
      });
      await tx.notificationSnapshot.create({
        data: {
          notificationId: notification.id,
          currentStatus: NotificationStatus.UNREAD,
          sentAt: event.createdAt,
          lastActivityAt: event.createdAt,
        },
      });
      return notification.id;
    });
  }
});
