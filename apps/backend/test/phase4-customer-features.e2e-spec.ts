import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaClient } from '@prisma/client';
import request from 'supertest';

import { AppModule } from '../src/app.module';
import { PrismaExceptionFilter } from '../src/common/filters/prisma-exception.filter';
import { packageIdentifier } from './support/asset-identifiers';

const prisma = new PrismaClient();

describe('Phase 4 customer features (e2e)', () => {
  let app: INestApplication;
  let sequence = 0;
  const unique = (prefix: string) =>
    `${prefix}-${Date.now().toString(36)}-${sequence++}`;
  const terminal = async (city: string) =>
    (
      await request(app.getHttpServer())
        .post('/terminals')
        .send({
          terminalCode: unique('CT'),
          city,
          province: 'Alberta',
          country: 'Canada',
          timezone: 'America/Edmonton',
        })
        .expect(201)
    ).body.terminal.id as number;

  beforeAll(async () => {
    const fixture = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = fixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    app.useGlobalFilters(new PrismaExceptionFilter());
    await app.init();
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  it('projects package movement into tracking, notifications, and reports', async () => {
    const originTerminalId = await terminal('Edmonton');
    const destinationTerminalId = await terminal('Calgary');
    const trackingNumber = packageIdentifier();
    const shipmentNumber = unique('CUSTOMER').toUpperCase();
    const recipient = `${unique('customer')}@example.com`.toLowerCase();

    await request(app.getHttpServer())
      .post('/package-events')
      .send({
        trackingNumber,
        eventType: 'PACKAGE_RECEIVED',
        terminalId: originTerminalId,
      })
      .expect(201);
    await request(app.getHttpServer())
      .post('/shipments')
      .send({
        shipmentNumber,
        referenceNumber: 'ORDER-PHASE-4',
        notificationRecipient: recipient,
        originTerminalId,
        destinationTerminalId,
        packageTrackingNumbers: [trackingNumber],
      })
      .expect(201);

    for (const eventType of [
      'PACKAGE_SORTED',
      'PACKAGE_LOADED_TO_TRAILER',
      'PACKAGE_DEPARTED',
      'PACKAGE_ARRIVED',
      'PACKAGE_OUT_FOR_DELIVERY',
    ]) {
      await request(app.getHttpServer())
        .post('/package-events')
        .send({
          trackingNumber,
          eventType,
          terminalId:
            eventType === 'PACKAGE_ARRIVED' ||
            eventType === 'PACKAGE_OUT_FOR_DELIVERY'
              ? destinationTerminalId
              : originTerminalId,
        })
        .expect(201);
    }

    const inTransit = await request(app.getHttpServer())
      .get(`/tracking/${shipmentNumber.toLowerCase()}`)
      .expect(200);
    expect(inTransit.body).toMatchObject({
      shipmentNumber,
      status: 'IN_TRANSIT',
      currentTerminal: { city: 'Calgary' },
      progress: {
        packageCount: 1,
        outForDeliveryPackages: 1,
        progressPercent: 0,
      },
    });
    expect(inTransit.body).not.toHaveProperty('notificationRecipient');

    const beforeDelivery = await request(app.getHttpServer())
      .get('/notifications')
      .query({ recipient })
      .expect(200);
    expect(
      beforeDelivery.body.map(
        (notification: { type: string }) => notification.type,
      ),
    ).toEqual(
      expect.arrayContaining(['SHIPMENT_CREATED', 'OUT_FOR_DELIVERY']),
    );

    await request(app.getHttpServer())
      .post('/package-events')
      .send({
        trackingNumber,
        eventType: 'PACKAGE_DELIVERED',
        terminalId: destinationTerminalId,
      })
      .expect(201);

    const delivered = await request(app.getHttpServer())
      .get(`/tracking/${shipmentNumber}`)
      .expect(200);
    expect(delivered.body).toMatchObject({
      status: 'COMPLETED',
      progress: {
        deliveredPackages: 1,
        remainingPackages: 0,
        progressPercent: 100,
      },
    });

    const notifications = await request(app.getHttpServer())
      .get('/notifications')
      .query({ recipient })
      .expect(200);
    expect(
      notifications.body.map(
        (notification: { type: string }) => notification.type,
      ),
    ).toContain('DELIVERED');

    const notificationId = notifications.body[0].id as string;
    const read = await request(app.getHttpServer())
      .patch(`/notifications/${notificationId}/read`)
      .expect(200);
    expect(read.body.snapshot.currentStatus).toBe('READ');
    const resent = await request(app.getHttpServer())
      .post(`/notifications/${notificationId}/resend`)
      .expect(201);
    expect(resent.body.snapshot).toMatchObject({
      currentStatus: 'UNREAD',
      deliveryAttempts: 2,
    });

    const date = new Date().toISOString().slice(0, 10);
    const report = await request(app.getHttpServer())
      .get('/reports/deliveries')
      .query({
        fromDate: date,
        toDate: date,
        originTerminalId,
        destinationTerminalId,
      })
      .expect(200);
    expect(report.body.totals).toMatchObject({
      totalShipments: 1,
      completedShipments: 1,
      totalPackages: 1,
      deliveredPackages: 1,
      completionRate: 100,
    });
  });
});
