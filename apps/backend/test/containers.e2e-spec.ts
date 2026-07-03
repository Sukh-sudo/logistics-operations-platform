import { packageIdentifier, containerIdentifier } from './support/asset-identifiers';
import { Test, TestingModule } from '@nestjs/testing';
import {INestApplication,ValidationPipe,} from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import request from 'supertest';

import { AppModule } from '../src/app.module';

const prisma = new PrismaClient();

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

  await prisma.$disconnect();
});

  it('should create container successfully', async () => {
    const barcode = containerIdentifier();

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

    expect(response.body.snapshot.packageType).toBe('CONVEYABLE');
    expect(response.body.event.metadata.packageType).toBe('CONVEYABLE');

    expect(
      response.body.event.eventType,
    ).toBe('CONTAINER_CREATED');
  });

  it('rejects an invalid or lowercase container barcode', async () => {
    await request(app.getHttpServer())
      .post('/containers')
      .send({ containerBarcode: 'con1234567' })
      .expect(400);
  });

  it('rejects loading a package into a container for another package type', async () => {
    const trackingNumber = packageIdentifier('DG');

    await request(app.getHttpServer())
      .post('/package-events')
      .send({ trackingNumber, eventType: 'PACKAGE_RECEIVED' })
      .expect(201);

    const container = await request(app.getHttpServer())
      .post('/containers')
      .send({ containerBarcode: containerIdentifier('CON') })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/containers/${container.body.snapshot.id}/load-package`)
      .send({ trackingNumber })
      .expect(400);

    const packageSnapshot = await prisma.packageSnapshot.findUniqueOrThrow({
      where: { trackingNumber },
    });
    expect(packageSnapshot.currentContainerId).toBeNull();
  });

  it('should reject duplicate container barcode', async () => {
    const barcode = containerIdentifier();

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
    const barcode = containerIdentifier();

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
    packageIdentifier();

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
        containerBarcode: containerIdentifier(),
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
    packageIdentifier();

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
        containerBarcode: containerIdentifier(),
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
    packageIdentifier();

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
        containerBarcode: containerIdentifier(),
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

it('should unload package from container', async () => {

  const trackingNumber =
    packageIdentifier();

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
        containerBarcode:
          containerIdentifier(),
      })
      .expect(201);

  const containerId =
    containerResponse.body.snapshot.id;

  // Load package
  await request(app.getHttpServer())
    .post(
      `/containers/${containerId}/load-package`,
    )
    .send({
      trackingNumber,
    })
    .expect(201);

  // Unload package
  const response =
    await request(app.getHttpServer())
      .post(
        `/containers/${containerId}/unload-package`,
      )
      .send({
        trackingNumber,
      })
      .expect(201);

  expect(response.body.success)
    .toBe(true);
});

it('should create PACKAGE_LOADED_TO_CONTAINER event', async () => {

  const trackingNumber =
    packageIdentifier();

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
        containerBarcode:
          containerIdentifier(),
      })
      .expect(201);

  const containerId =
    containerResponse.body.snapshot.id;

  // Load package
  await request(app.getHttpServer())
    .post(
      `/containers/${containerId}/load-package`,
    )
    .send({
      trackingNumber,
    })
    .expect(201);

  // Verify event exists
  const packageRecord =
    await prisma.packageSnapshot.findUnique({
      where: { trackingNumber },
      include: { events: true },
    });

  expect(
    packageRecord?.events.some(
      (e) =>
        e.eventType ===
        'PACKAGE_LOADED_TO_CONTAINER',
    ),
  ).toBe(true);
});

it('should create PACKAGE_UNLOADED_FROM_CONTAINER event', async () => {

  const trackingNumber =
    packageIdentifier();

  // Create package
  await request(app.getHttpServer())
    .post('/package-events')
    .send({
      trackingNumber,
      eventType: 'PACKAGE_RECEIVED',
    });

  // Create container
  const containerResponse =
    await request(app.getHttpServer())
      .post('/containers')
      .send({
        containerBarcode:
          containerIdentifier(),
      });

  const containerId =
    containerResponse.body.snapshot.id;

  // Load package
  await request(app.getHttpServer())
    .post(
      `/containers/${containerId}/load-package`,
    )
    .send({
      trackingNumber,
    });

  // Unload package
  await request(app.getHttpServer())
    .post(
      `/containers/${containerId}/unload-package`,
    )
    .send({
      trackingNumber,
    })
    .expect(201);

  // Verify event exists
  const packageRecord =
    await prisma.packageSnapshot.findUnique({
      where: { trackingNumber },
      include: { events: true },
    });

  expect(
    packageRecord?.events.some(
      (e) =>
        e.eventType ===
        'PACKAGE_UNLOADED_FROM_CONTAINER',
    ),
  ).toBe(true);
});

it('should return packages inside container', async () => {
  const packageA = packageIdentifier();
  const packageB = packageIdentifier();

  // Create packages
  await request(app.getHttpServer())
    .post('/package-events')
    .send({
      trackingNumber: packageA,
      eventType: 'PACKAGE_RECEIVED',
      terminalId: 1,
      employeeId: 100,
    })
    .expect(201);

  await request(app.getHttpServer())
    .post('/package-events')
    .send({
      trackingNumber: packageB,
      eventType: 'PACKAGE_RECEIVED',
      terminalId: 1,
      employeeId: 100,
    })
    .expect(201);

  // Create container
  const containerResponse = await request(
    app.getHttpServer(),
  )
    .post('/containers')
    .send({
      containerBarcode: containerIdentifier(),
    })
    .expect(201);

  const containerId =
    containerResponse.body.snapshot.id;

  const containerBarcode =
    containerResponse.body.snapshot.containerBarcode;

  // Load packages
  await request(app.getHttpServer())
    .post(
      `/containers/${containerId}/load-package`,
    )
    .send({
      trackingNumber: packageA,
    })
    .expect(201);

  await request(app.getHttpServer())
    .post(
      `/containers/${containerId}/load-package`,
    )
    .send({
      trackingNumber: packageB,
    })
    .expect(201);

  // Query container packages
  const response = await request(
    app.getHttpServer(),
  )
    .get(
      `/containers/${containerBarcode}/packages`,
    )
    .expect(200);

  expect(response.body.containerBarcode)
    .toBe(containerBarcode);

  expect(response.body.packageCount)
    .toBe(2);

  expect(
    response.body.packages.map(
      (p: any) => p.trackingNumber,
    ),
  ).toEqual(
    expect.arrayContaining([
      packageA,
      packageB,
    ]),
  );
});

it('should return 404 for unknown container', async () => {
  await request(app.getHttpServer())
    .get('/containers/UNKNOWN/packages')
    .expect(404);
});

});
