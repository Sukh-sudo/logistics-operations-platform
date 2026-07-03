import { packageIdentifier, containerIdentifier, trailerIdentifier } from './support/asset-identifiers';
import { Test, TestingModule } from '@nestjs/testing';
import {INestApplication,ValidationPipe,} from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import request from 'supertest';

import { AppModule } from '../src/app.module';

describe('Search API (e2e)', () => {
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

  it('should find package by barcode', async () => {
    const trackingNumber =
      packageIdentifier();

    await request(app.getHttpServer())
      .post('/package-events')
      .send({
        trackingNumber,
        eventType: 'PACKAGE_RECEIVED',
        terminalId: 1,
        employeeId: 100,
      })
      .expect(201);

    const response = await request(
      app.getHttpServer(),
    )
      .get(`/search/${trackingNumber}`)
      .expect(200);

    expect(response.body.type)
      .toBe('PACKAGE');

    expect(
      response.body.data.trackingNumber,
    ).toBe(trackingNumber);
  });

  it('should find container by barcode', async () => {
    const barcode =
      containerIdentifier();

    await request(app.getHttpServer())
      .post('/containers')
      .send({
        containerBarcode: barcode,
      })
      .expect(201);

    const response = await request(
      app.getHttpServer(),
    )
      .get(`/search/${barcode}`)
      .expect(200);

    expect(response.body.type)
      .toBe('CONTAINER');

    expect(
      response.body.data.containerBarcode,
    ).toBe(barcode);
  });

  it('should find trailer by barcode', async () => {
    const barcode =
      trailerIdentifier();

    await request(app.getHttpServer())
      .post('/trailers')
      .send({
        trailerBarcode: barcode,
      })
      .expect(201);

    const response = await request(
      app.getHttpServer(),
    )
      .get(`/search/${barcode}`)
      .expect(200);

    expect(response.body.type)
      .toBe('TRAILER');

    expect(
      response.body.data.trailerBarcode,
    ).toBe(barcode);
  });

  it('should return 404 for unknown barcode', async () => {
    await request(app.getHttpServer())
      .get(`/search/UNKNOWN-${Date.now()}`)
      .expect(404);
  });
});