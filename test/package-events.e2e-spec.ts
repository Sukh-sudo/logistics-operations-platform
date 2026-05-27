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
    // Shutdown app cleanly after tests
    await app.close();
  });

  it('should create package event successfully', async () => {
    const payload = {
      trackingNumber: 'PKG-TEST-001',
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
});