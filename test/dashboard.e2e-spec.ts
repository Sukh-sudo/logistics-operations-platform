import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';

import { AppModule } from '../src/app.module';

describe('Dashboard API (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule =
      await Test.createTestingModule({
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

    await app.init();
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  it('should return dashboard summary', async () => {
    const response = await request(app.getHttpServer())
      .get('/dashboard/summary')
      .expect(200);

    expect(response.body).toHaveProperty('packages');
    expect(response.body).toHaveProperty('containers');
    expect(response.body).toHaveProperty('trailers');

    expect(response.body.packages).toHaveProperty('received');
    expect(response.body.packages).toHaveProperty('sorted');
    expect(response.body.packages).toHaveProperty('inContainer');
    expect(response.body.packages).toHaveProperty('inTrailer');
    expect(response.body.packages).toHaveProperty('delivered');
  });

  it('should return trailer dashboard', async () => {
    const response = await request(app.getHttpServer())
      .get('/dashboard/trailers')
      .expect(200);

    expect(Array.isArray(response.body)).toBe(true);
  });

  it('should return container dashboard', async () => {
    const response = await request(app.getHttpServer())
      .get('/dashboard/containers')
      .expect(200);

    expect(Array.isArray(response.body)).toBe(true);
  });

  it('should return package dashboard', async () => {
    const response = await request(app.getHttpServer())
      .get('/dashboard/packages')
      .expect(200);

    expect(Array.isArray(response.body)).toBe(true);
  });

  it('should return recent events', async () => {
    const response = await request(app.getHttpServer())
      .get('/dashboard/recent-events')
      .expect(200);

    expect(Array.isArray(response.body)).toBe(true);
  });

  it('should update dashboard after creating package', async () => {
    const trackingNumber = `PKG-DASH-${Date.now()}`;

    await request(app.getHttpServer())
      .post('/package-events')
      .send({
        trackingNumber,
        eventType: 'PACKAGE_RECEIVED',
        terminalId: 1,
        employeeId: 100,
      })
      .expect(201);

    const response = await request(app.getHttpServer())
      .get('/dashboard/summary')
      .expect(200);

    expect(response.body.packages.received).toBeGreaterThan(0);
  });

  it('should update dashboard after creating container', async () => {
    await request(app.getHttpServer())
      .post('/containers')
      .send({
        containerBarcode: `CONT-DASH-${Date.now()}`,
      })
      .expect(201);

    const response = await request(app.getHttpServer())
      .get('/dashboard/containers')
      .expect(200);

    expect(Array.isArray(response.body)).toBe(true);
    expect(response.body.length).toBeGreaterThan(0);
  });

  it('should update dashboard after creating trailer', async () => {
    await request(app.getHttpServer())
      .post('/trailers')
      .send({
        trailerBarcode: `TRL-DASH-${Date.now()}`,
      })
      .expect(201);

    const response = await request(app.getHttpServer())
      .get('/dashboard/trailers')
      .expect(200);

    expect(Array.isArray(response.body)).toBe(true);
    expect(response.body.length).toBeGreaterThan(0);
  });

  it('should return recent events after activity', async () => {
    const trackingNumber = `PKG-EVENT-${Date.now()}`;

    await request(app.getHttpServer())
      .post('/package-events')
      .send({
        trackingNumber,
        eventType: 'PACKAGE_RECEIVED',
        terminalId: 1,
        employeeId: 100,
      })
      .expect(201);

    const response = await request(app.getHttpServer())
      .get('/dashboard/recent-events')
      .expect(200);

    expect(response.body.length).toBeGreaterThan(0);
  });
});