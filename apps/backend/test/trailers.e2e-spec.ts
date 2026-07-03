import { containerIdentifier, trailerIdentifier } from './support/asset-identifiers';
import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { ValidationPipe } from '@nestjs/common';
import { PrismaExceptionFilter } from '../src/common/filters/prisma-exception.filter';
import { PrismaService } from '../src/infrastructure/prisma/prisma.service';

import request from 'supertest';

import { AppModule } from '../src/app.module';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

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
      await prisma.$disconnect();
    }
  });

  it('should create trailer successfully', async () => {
    const barcode = trailerIdentifier();

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
      trailerIdentifier();

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
      trailerIdentifier();

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

  it('should reject a lowercase or incorrectly sized trailer barcode', async () => {
    await request(app.getHttpServer())
      .post('/trailers')
      .send({ trailerBarcode: 'trlr123456' })
      .expect(400);
  });

  it('should load container into trailer', async () => {

  // Create container
  const containerResponse =
    await request(app.getHttpServer())
      .post('/containers')
      .send({
        containerBarcode:
          containerIdentifier(),
      })
      .expect(201);

  // Create trailer
  const trailerResponse =
    await request(app.getHttpServer())
      .post('/trailers')
      .send({
        trailerBarcode:
          trailerIdentifier(),
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
    containerIdentifier();

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
          trailerIdentifier(),
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
    containerIdentifier();

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
          trailerIdentifier(),
      })
      .expect(201);

  const trailer2 =
    await request(app.getHttpServer())
      .post('/trailers')
      .send({
        trailerBarcode:
          trailerIdentifier(),
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
          containerIdentifier(),
      })
      .expect(201);

  const trailerResponse =
    await request(app.getHttpServer())
      .post('/trailers')
      .send({
        trailerBarcode:
          trailerIdentifier(),
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
          containerIdentifier(),
      });

  const trailer =
    await request(app.getHttpServer())
      .post('/trailers')
      .send({
        trailerBarcode:
          trailerIdentifier(),
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
    containerIdentifier();

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
          trailerIdentifier(),
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

it('should create CONTAINER_LOADED_TO_TRAILER event', async () => {

  const container =
    await request(app.getHttpServer())
      .post('/containers')
      .send({
        containerBarcode: containerIdentifier(),
      });

  const trailer =
    await request(app.getHttpServer())
      .post('/trailers')
      .send({
        trailerBarcode: trailerIdentifier(),
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

});
it('should create CONTAINER_UNLOADED_FROM_TRAILER event', async () => {

  const barcode =
    containerIdentifier();

  const container =
    await request(app.getHttpServer())
      .post('/containers')
      .send({
        containerBarcode: barcode,
      })
      .expect(201);

  const trailer =
    await request(app.getHttpServer())
      .post('/trailers')
      .send({
        trailerBarcode:
          trailerIdentifier(),
      })
      .expect(201);

  const trailerId =
    trailer.body.snapshot.id;

  await request(app.getHttpServer())
    .post(
      `/trailers/${trailerId}/load-container`,
    )
    .send({
      containerBarcode: barcode,
    })
    .expect(201);

  await request(app.getHttpServer())
    .post(
      `/trailers/${trailerId}/unload-container`,
    )
    .send({
      containerBarcode: barcode,
    })
    .expect(201);

  const event =
    await prisma.trailerEvent.findFirst({
      where: {
        trailerId,
        eventType:
          'CONTAINER_UNLOADED_FROM_TRAILER',
      },
    });

  expect(event).not.toBeNull();
});

it('should return containers inside trailer', async () => {
  const trailerResponse = await request(
    app.getHttpServer(),
  )
    .post('/trailers')
    .send({
      trailerBarcode: trailerIdentifier(),
    })
    .expect(201);

  const trailerId =
    trailerResponse.body.snapshot.id;

  const trailerBarcode =
    trailerResponse.body.snapshot.trailerBarcode;

  const containerA =
    await request(app.getHttpServer())
      .post('/containers')
      .send({
        containerBarcode: containerIdentifier(),
      })
      .expect(201);

  const containerB =
    await request(app.getHttpServer())
      .post('/containers')
      .send({
        containerBarcode: containerIdentifier(),
      })
      .expect(201);

  await request(app.getHttpServer())
    .post(
      `/trailers/${trailerId}/load-container`,
    )
    .send({
      containerBarcode:
        containerA.body.snapshot.containerBarcode,
    })
    .expect(201);

  await request(app.getHttpServer())
    .post(
      `/trailers/${trailerId}/load-container`,
    )
    .send({
      containerBarcode:
        containerB.body.snapshot.containerBarcode,
    })
    .expect(201);

  const response = await request(
    app.getHttpServer(),
  )
    .get(
      `/trailers/${trailerBarcode}/containers`,
    )
    .expect(200);

  expect(response.body.containerCount)
    .toBe(2);

  expect(
    response.body.containers.map(
      (c: any) => c.containerBarcode,
    ),
  ).toEqual(
    expect.arrayContaining([
      containerA.body.snapshot.containerBarcode,
      containerB.body.snapshot.containerBarcode,
    ]),
  );
});

it('should return 404 for unknown trailer', async () => {
  await request(app.getHttpServer())
    .get('/trailers/UNKNOWN/containers')
    .expect(404);
});

});
