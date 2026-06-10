import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { ValidationPipe } from '@nestjs/common';
import { PrismaExceptionFilter } from '../src/common/filters/prisma-exception.filter';
import { PrismaService } from '../src/infrastructure/prisma/prisma.service';

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

  it('should load container into trailer', async () => {

  // Create container
  const containerResponse =
    await request(app.getHttpServer())
      .post('/containers')
      .send({
        containerBarcode:
          `CONT-${Date.now()}`,
      })
      .expect(201);

  // Create trailer
  const trailerResponse =
    await request(app.getHttpServer())
      .post('/trailers')
      .send({
        trailerBarcode:
          `TRL-${Date.now()}`,
      })
      .expect(201);

  const trailerId =
    trailerResponse.body.snapshot.id;

  const containerBarcode =
    containerResponse.body.snapshot.containerBarcode;

  const response =
    await request(app.getHttpServer())
      .post(
        `/trailers/${trailerId}/load-container`,
      )
      .send({
        containerBarcode,
      })
      .expect(201);

  expect(response.body.success)
    .toBe(true);
});

it('should unload container from trailer', async () => {

  const barcode =
    `CONT-UNLOAD-${Date.now()}`;

  const containerResponse =
    await request(app.getHttpServer())
      .post('/containers')
      .send({
        containerBarcode: barcode,
      })
      .expect(201);

  const trailerResponse =
    await request(app.getHttpServer())
      .post('/trailers')
      .send({
        trailerBarcode:
          `TRL-UNLOAD-${Date.now()}`,
      })
      .expect(201);

  const trailerId =
    trailerResponse.body.snapshot.id;

  // Load container first
  await request(app.getHttpServer())
    .post(
      `/trailers/${trailerId}/load-container`,
    )
    .send({
      containerBarcode: barcode,
    })
    .expect(201);

  // Unload container
  const response =
    await request(app.getHttpServer())
      .post(
        `/trailers/${trailerId}/unload-container`,
      )
      .send({
        containerBarcode: barcode,
      })
      .expect(201);

  expect(response.body.success)
    .toBe(true);
});

it('should reject loading container already assigned to trailer', async () => {

  const barcode =
    `CONT-DUP-${Date.now()}`;

  const containerResponse =
    await request(app.getHttpServer())
      .post('/containers')
      .send({
        containerBarcode: barcode,
      })
      .expect(201);

  const trailer1 =
    await request(app.getHttpServer())
      .post('/trailers')
      .send({
        trailerBarcode:
          `TRL-A-${Date.now()}`,
      })
      .expect(201);

  const trailer2 =
    await request(app.getHttpServer())
      .post('/trailers')
      .send({
        trailerBarcode:
          `TRL-B-${Date.now()}`,
      })
      .expect(201);

  await request(app.getHttpServer())
    .post(
      `/trailers/${trailer1.body.snapshot.id}/load-container`,
    )
    .send({
      containerBarcode: barcode,
    })
    .expect(201);

  await request(app.getHttpServer())
    .post(
      `/trailers/${trailer2.body.snapshot.id}/load-container`,
    )
    .send({
      containerBarcode: barcode,
    })
    .expect(400);
});

it('should reject unloading container not assigned to trailer', async () => {

  const containerResponse =
    await request(app.getHttpServer())
      .post('/containers')
      .send({
        containerBarcode:
          `CONT-NOT-${Date.now()}`,
      })
      .expect(201);

  const trailerResponse =
    await request(app.getHttpServer())
      .post('/trailers')
      .send({
        trailerBarcode:
          `TRL-NOT-${Date.now()}`,
      })
      .expect(201);

  await request(app.getHttpServer())
    .post(
      `/trailers/${trailerResponse.body.snapshot.id}/unload-container`,
    )
    .send({
      containerBarcode:
        containerResponse.body.snapshot.containerBarcode,
    })
    .expect(400);
});

it('should increment trailer container count', async () => {

  const container =
    await request(app.getHttpServer())
      .post('/containers')
      .send({
        containerBarcode:
          `CONT-COUNT-${Date.now()}`,
      });

  const trailer =
    await request(app.getHttpServer())
      .post('/trailers')
      .send({
        trailerBarcode:
          `TRL-COUNT-${Date.now()}`,
      });

  const trailerId =
    trailer.body.snapshot.id;

  await request(app.getHttpServer())
    .post(
      `/trailers/${trailerId}/load-container`,
    )
    .send({
      containerBarcode:
        container.body.snapshot.containerBarcode,
    })
    .expect(201);

  const prisma =
    app.get(PrismaService);

  const snapshot =
    await prisma.trailerSnapshot.findUnique({
      where: {
        id: trailerId,
      },
    });

  expect(snapshot?.containerCount)
    .toBe(1);
});

it('should decrement trailer container count', async () => {

  const barcode =
    `CONT-DEC-${Date.now()}`;

  const container =
    await request(app.getHttpServer())
      .post('/containers')
      .send({
        containerBarcode: barcode,
      });

  const trailer =
    await request(app.getHttpServer())
      .post('/trailers')
      .send({
        trailerBarcode:
          `TRL-DEC-${Date.now()}`,
      });

  const trailerId =
    trailer.body.snapshot.id;

  await request(app.getHttpServer())
    .post(
      `/trailers/${trailerId}/load-container`,
    )
    .send({
      containerBarcode: barcode,
    });

  await request(app.getHttpServer())
    .post(
      `/trailers/${trailerId}/unload-container`,
    )
    .send({
      containerBarcode: barcode,
    });

  const prisma =
    app.get(PrismaService);

  const snapshot =
    await prisma.trailerSnapshot.findUnique({
      where: {
        id: trailerId,
      },
    });

  expect(snapshot?.containerCount)
    .toBe(0);
});



});