import { Test, TestingModule } from '@nestjs/testing';
import {
  INestApplication,
  ValidationPipe,
} from '@nestjs/common';

import request from 'supertest';

import { AppModule } from '../src/app.module';

describe('Containers (e2e)', () => {
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

  it('should create container successfully', async () => {
    const barcode = `CONT-${Date.now()}`;

    const response = await request(app.getHttpServer())
      .post('/containers')
      .send({
        containerBarcode: barcode,
      })
      .expect(201);

    expect(response.body.snapshot).toBeDefined();

    expect(response.body.event).toBeDefined();

    expect(
      response.body.snapshot.containerBarcode,
    ).toBe(barcode);

    expect(
      response.body.snapshot.currentStatus,
    ).toBe('OPEN');

    expect(
      response.body.event.eventType,
    ).toBe('CONTAINER_CREATED');
  });

  it('should reject duplicate container barcode', async () => {
    const barcode = `CONT-DUP-${Date.now()}`;

    await request(app.getHttpServer())
      .post('/containers')
      .send({
        containerBarcode: barcode,
      })
      .expect(201);

    await request(app.getHttpServer())
      .post('/containers')
      .send({
        containerBarcode: barcode,
      })
      .expect(409);
  });

  it('should create container creation event', async () => {
    const barcode = `CONT-EVENT-${Date.now()}`;

    const response = await request(app.getHttpServer())
      .post('/containers')
      .send({
        containerBarcode: barcode,
      })
      .expect(201);

    expect(
      response.body.event.eventType,
    ).toBe('CONTAINER_CREATED');
  });

  it('should load package into container', async () => {
  const trackingNumber =
    `PKG-LOAD-${Date.now()}`;

  // Create package
  await request(app.getHttpServer())
    .post('/package-events')
    .send({
      trackingNumber,
      eventType: 'PACKAGE_RECEIVED',
    })
    .expect(201);

  // Create container
  const containerResponse =
    await request(app.getHttpServer())
      .post('/containers')
      .send({
        containerBarcode: `CONT-LOAD-${Date.now()}`,
      })
      .expect(201);

  const containerId =
    containerResponse.body.snapshot.id;

  // Load package
  const response =
    await request(app.getHttpServer())
      .post(
        `/containers/${containerId}/load-package`,
      )
      .send({
        trackingNumber,
      })
      .expect(201);

  expect(response.body.success).toBe(true);
});

it('should reject loading package twice', async () => {
  const trackingNumber =
    `PKG-DUPLOAD-${Date.now()}`;

  await request(app.getHttpServer())
    .post('/package-events')
    .send({
      trackingNumber,
      eventType: 'PACKAGE_RECEIVED',
    });

  const containerResponse =
    await request(app.getHttpServer())
      .post('/containers')
      .send({
        containerBarcode: `CONT-DUPLOAD-${Date.now()}`,
      });

  const containerId =
    containerResponse.body.snapshot.id;

  await request(app.getHttpServer())
    .post(
      `/containers/${containerId}/load-package`,
    )
    .send({
      trackingNumber,
    })
    .expect(201);

  await request(app.getHttpServer())
    .post(
      `/containers/${containerId}/load-package`,
    )
    .send({
      trackingNumber,
    })
    .expect(400);
});

it('should load package into container', async () => {

  const trackingNumber =
    `PKG-${Date.now()}`;

  await request(app.getHttpServer())
    .post('/package-events')
    .send({
      trackingNumber,
      eventType: 'PACKAGE_RECEIVED',
    })
    .expect(201);

  const containerResponse =
    await request(app.getHttpServer())
      .post('/containers')
      .send({
        containerBarcode: `CONT-${Date.now()}`,
      })
      .expect(201);

  const containerId =
    containerResponse.body.snapshot.id;

  const response =
    await request(app.getHttpServer())
      .post(
        `/containers/${containerId}/load-package`,
      )
      .send({
        trackingNumber,
      })
      .expect(201);

  expect(response.body.success)
    .toBe(true);
});

});