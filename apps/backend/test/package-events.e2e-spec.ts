import { packageIdentifier } from './support/asset-identifiers';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';

import request from 'supertest';

import { AppModule } from '../src/app.module';

describe('Package Events (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    // Create Nest testing module
    const moduleFixture: TestingModule =
      await Test.createTestingModule({
        imports: [AppModule],
      }).compile();

    // Create Nest application instance
    app = moduleFixture.createNestApplication();

    // Enable same validation used in production
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );

    await app.init();
  });

  afterAll(async () => {

  // Only close app if app initialized successfully
  if (app) {
    await app.close();
  }
  });

  it('should create package event successfully', async () => {
    const payload = {
      trackingNumber: packageIdentifier(),
      eventType: 'PACKAGE_RECEIVED',
      terminalId: 1,
      employeeId: 55,
    };

    const response = await request(app.getHttpServer())
      .post('/package-events')
      .send(payload)
      .expect(201);

    // Verify snapshot exists
    expect(response.body.snapshot).toBeDefined();

    // Verify event exists
    expect(response.body.event).toBeDefined();

    // Verify correct status transition
    expect(response.body.snapshot.currentStatus).toBe(
      'RECEIVED',
    );
    expect(response.body.snapshot.packageType).toBe('CONVEYABLE');
    expect(response.body.event.metadata.packageType).toBe('CONVEYABLE');
  });

  it('should reject a lowercase tracking number', async () => {
    await request(app.getHttpServer())
      .post('/package-events')
      .send({ trackingNumber: 'mail123456', eventType: 'PACKAGE_RECEIVED' })
      .expect(400);
  });

  it('should reject invalid payload', async () => {
    const invalidPayload = {
      trackingNumber: '',
      eventType: 'INVALID_EVENT',
    };

    await request(app.getHttpServer())
      .post('/package-events')
      .send(invalidPayload)
      .expect(400);
  });

  it('should reject invalid lifecycle transition', async () => {

  const trackingNumber = packageIdentifier();

  // First move package to DELIVERED state
  await request(app.getHttpServer())
    .post('/package-events')
    .send({
      trackingNumber,
      eventType: 'PACKAGE_RECEIVED',
    });

  await request(app.getHttpServer())
    .post('/package-events')
    .send({
      trackingNumber,
      eventType: 'PACKAGE_IN_TRANSIT',
    });

  await request(app.getHttpServer())
    .post('/package-events')
    .send({
      trackingNumber,
      eventType: 'PACKAGE_DELIVERED',
    });

  // Attempt invalid reverse transition
  await request(app.getHttpServer())
    .post('/package-events')
    .send({
      trackingNumber,
      eventType: 'PACKAGE_IN_TRANSIT',
    })
    .expect(400);
  });

  it('should reject invalid CREATED → DELIVERED transition', async () => {

  const trackingNumber = packageIdentifier();

  await request(app.getHttpServer())
    .post('/package-events')
    .send({
      trackingNumber,
      eventType: 'PACKAGE_DELIVERED',
    })
    .expect(400);
  });

  it('should reject DELIVERED → IN_TRANSIT transition', async () => {

  const trackingNumber = packageIdentifier();

  // Move through valid lifecycle first
  await request(app.getHttpServer())
    .post('/package-events')
    .send({
      trackingNumber,
      eventType: 'PACKAGE_RECEIVED',
    });

  await request(app.getHttpServer())
    .post('/package-events')
    .send({
      trackingNumber,
      eventType: 'PACKAGE_IN_TRANSIT',
    });

  await request(app.getHttpServer())
    .post('/package-events')
    .send({
      trackingNumber,
      eventType: 'PACKAGE_DELIVERED',
    });

  // Attempt invalid reverse transition
  await request(app.getHttpServer())
    .post('/package-events')
    .send({
      trackingNumber,
      eventType: 'PACKAGE_IN_TRANSIT',
    })
    .expect(400);
  });

  it('should process full package lifecycle correctly', async () => {

  const trackingNumber =
    packageIdentifier();

  // RECEIVED
  let response = await request(app.getHttpServer())
    .post('/package-events')
    .send({
      trackingNumber,
      eventType: 'PACKAGE_RECEIVED',
      terminalId: 1,
      employeeId: 101,
    })
    .expect(201);

  expect(
    response.body.snapshot.currentStatus,
  ).toBe('RECEIVED');

  // SORTED
  response = await request(app.getHttpServer())
    .post('/package-events')
    .send({
      trackingNumber,
      eventType: 'PACKAGE_SORTED',
      terminalId: 1,
      employeeId: 101,
    })
    .expect(201);

  expect(
    response.body.snapshot.currentStatus,
  ).toBe('SORTED');

  // IN_CONTAINER
  response = await request(app.getHttpServer())
    .post('/package-events')
    .send({
      trackingNumber,
      eventType: 'PACKAGE_LOADED_TO_CONTAINER',
      terminalId: 1,
      employeeId: 101,
    })
    .expect(201);

  expect(
    response.body.snapshot.currentStatus,
  ).toBe('IN_CONTAINER');

  // IN_TRAILER
  response = await request(app.getHttpServer())
    .post('/package-events')
    .send({
      trackingNumber,
      eventType: 'PACKAGE_LOADED_TO_TRAILER',
      terminalId: 1,
      employeeId: 101,
    })
    .expect(201);

  expect(
    response.body.snapshot.currentStatus,
  ).toBe('IN_TRAILER');

  // DEPARTED
  response = await request(app.getHttpServer())
    .post('/package-events')
    .send({
      trackingNumber,
      eventType: 'PACKAGE_DEPARTED',
      terminalId: 1,
      employeeId: 101,
    })
    .expect(201);

  expect(
    response.body.snapshot.currentStatus,
  ).toBe('DEPARTED');

  // ARRIVED
  response = await request(app.getHttpServer())
    .post('/package-events')
    .send({
      trackingNumber,
      eventType: 'PACKAGE_ARRIVED',
      terminalId: 2,
      employeeId: 102,
    })
    .expect(201);

  expect(
    response.body.snapshot.currentStatus,
  ).toBe('ARRIVED');

  // OUT FOR DELIVERY
  response = await request(app.getHttpServer())
    .post('/package-events')
    .send({
      trackingNumber,
      eventType: 'PACKAGE_OUT_FOR_DELIVERY',
      terminalId: 2,
      employeeId: 102,
    })
    .expect(201);

  expect(
    response.body.snapshot.currentStatus,
  ).toBe('OUT_FOR_DELIVERY');

  // DELIVERED
  response = await request(app.getHttpServer())
    .post('/package-events')
    .send({
      trackingNumber,
      eventType: 'PACKAGE_DELIVERED',
      terminalId: 2,
      employeeId: 102,
    })
    .expect(201);

  expect(
    response.body.snapshot.currentStatus,
  ).toBe('DELIVERED');
});

it('should reject DELIVERED back to IN_TRAILER transition', async () => {

  const trackingNumber =
    packageIdentifier();

  await request(app.getHttpServer())
    .post('/package-events')
    .send({
      trackingNumber,
      eventType: 'PACKAGE_RECEIVED',
    });

  await request(app.getHttpServer())
    .post('/package-events')
    .send({
      trackingNumber,
      eventType: 'PACKAGE_SORTED',
    });

  await request(app.getHttpServer())
    .post('/package-events')
    .send({
      trackingNumber,
      eventType: 'PACKAGE_LOADED_TO_TRAILER',
    });

  await request(app.getHttpServer())
    .post('/package-events')
    .send({
      trackingNumber,
      eventType: 'PACKAGE_DEPARTED',
    });

  await request(app.getHttpServer())
    .post('/package-events')
    .send({
      trackingNumber,
      eventType: 'PACKAGE_ARRIVED',
    });

  await request(app.getHttpServer())
    .post('/package-events')
    .send({
      trackingNumber,
      eventType: 'PACKAGE_OUT_FOR_DELIVERY',
    });

  await request(app.getHttpServer())
    .post('/package-events')
    .send({
      trackingNumber,
      eventType: 'PACKAGE_DELIVERED',
    });

  await request(app.getHttpServer())
    .post('/package-events')
    .send({
      trackingNumber,
      eventType: 'PACKAGE_LOADED_TO_TRAILER',
    })
    .expect(400);
});


});
