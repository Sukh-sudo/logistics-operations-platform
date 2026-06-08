import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { ValidationPipe } from '@nestjs/common';
import { PrismaExceptionFilter } from '../src/common/filters/prisma-exception.filter';

import request from 'supertest';

import { AppModule } from '../src/app.module';

describe('Trailers (e2e)', () => {
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

app.useGlobalFilters(
  new PrismaExceptionFilter(),
);

await app.init();
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  it('should create trailer successfully', async () => {
    const barcode = `TRL-${Date.now()}`;

    const response = await request(
      app.getHttpServer(),
    )
      .post('/trailers')
      .send({
        trailerBarcode: barcode,
      })
      .expect(201);

    expect(response.body.snapshot)
      .toBeDefined();

    expect(response.body.event)
      .toBeDefined();

    expect(
      response.body.snapshot.trailerBarcode,
    ).toBe(barcode);

    expect(
      response.body.snapshot.currentStatus,
    ).toBe('OPEN');
  });

  it('should reject duplicate trailer barcode', async () => {
    const barcode =
      `TRL-DUP-${Date.now()}`;

    await request(app.getHttpServer())
      .post('/trailers')
      .send({
        trailerBarcode: barcode,
      })
      .expect(201);

    await request(app.getHttpServer())
      .post('/trailers')
      .send({
        trailerBarcode: barcode,
      })
      .expect(409);
  });

  it('should create trailer creation event', async () => {
    const barcode =
      `TRL-EVENT-${Date.now()}`;

    const response = await request(
      app.getHttpServer(),
    )
      .post('/trailers')
      .send({
        trailerBarcode: barcode,
      })
      .expect(201);

    expect(
      response.body.event.eventType,
    ).toBe('TRAILER_CREATED');
  });

  it('should validate trailer barcode is required', async () => {
    await request(app.getHttpServer())
      .post('/trailers')
      .send({})
      .expect(400);
  });

  it('should validate trailer barcode is a string', async () => {
    await request(app.getHttpServer())
      .post('/trailers')
      .send({
        trailerBarcode: 12345,
      })
      .expect(400);
  });
});