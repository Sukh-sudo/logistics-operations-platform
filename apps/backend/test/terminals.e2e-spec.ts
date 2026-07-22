import {
  INestApplication,
  ValidationPipe,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import {
  PrismaClient,
  TerminalAssetType,
  TerminalEventType,
} from '@prisma/client';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaExceptionFilter } from '../src/common/filters/prisma-exception.filter';
import { containerIdentifier, packageIdentifier, trailerIdentifier } from './support/asset-identifiers';

const prisma = new PrismaClient();

describe('Terminals (e2e)', () => {
  let app: INestApplication;
  let sequence = 0;

  const unique = (prefix: string) =>
    `${prefix}-${Date.now().toString(36)}-${sequence++}`;

  const createTerminal = async (code = unique('T')) =>
    request(app.getHttpServer())
      .post('/terminals')
      .send({
        terminalCode: code,
        city: 'Calgary',
        province: 'Alberta',
        country: 'Canada',
        timezone: 'America/Edmonton',
      })
      .expect(201);

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
    app.useGlobalFilters(new PrismaExceptionFilter());
    await app.init();
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  it('creates a terminal with an immutable event and snapshot', async () => {
    const code = unique('YYC');
    const response = await createTerminal(code);

    expect(response.body.terminal.terminalCode).toBe(code.toUpperCase());
    expect(response.body.terminal.name).toMatch(/^Calgary-\d{3}$/);
    expect(response.body.snapshot.currentStatus).toBe('ACTIVE');
    expect(response.body.event.eventType).toBe('TERMINAL_CREATED');

    const event = await prisma.terminalEvent.findUnique({
      where: { id: response.body.event.id },
    });
    expect(event?.terminalId).toBe(response.body.terminal.id);
  });

  it('validates terminal input and rejects duplicate terminal codes', async () => {
    await request(app.getHttpServer())
      .post('/terminals')
      .send({ terminalCode: 'INVALID' })
      .expect(400);

    await request(app.getHttpServer())
      .post('/terminals')
      .send({
        terminalCode: unique('NAME'),
        name: 'Free-form terminal name',
        city: 'Calgary',
        province: 'Alberta',
        country: 'Canada',
        timezone: 'America/Edmonton',
      })
      .expect(400);

    const code = unique('DUP');
    await createTerminal(code);
    await request(app.getHttpServer())
      .post('/terminals')
      .send({
        terminalCode: code,
        city: 'Calgary',
        province: 'Alberta',
        country: 'Canada',
        timezone: 'America/Edmonton',
      })
      .expect(409);
  });

  it('lists, retrieves, updates, and returns terminal history', async () => {
    const created = await createTerminal(unique('CRUD'));
    const terminalId = created.body.terminal.id;

    const updated = await request(app.getHttpServer())
      .patch(`/terminals/${terminalId}`)
      .send({
        city: 'Airdrie',
        status: 'MAINTENANCE',
      })
      .expect(200);

    expect(updated.body.terminal.name).toMatch(/^Airdrie-\d{3}$/);
    expect(updated.body.snapshot.currentStatus).toBe('MAINTENANCE');
    expect(updated.body.event.eventType).toBe('TERMINAL_UPDATED');

    const terminal = await request(app.getHttpServer())
      .get(`/terminals/${terminalId}`)
      .expect(200);
    expect(terminal.body.snapshot.currentStatus).toBe('MAINTENANCE');

    const history = await request(app.getHttpServer())
      .get(`/terminals/${terminalId}/history`)
      .expect(200);
    expect(history.body.map((event: any) => event.eventType)).toEqual([
      'TERMINAL_CREATED',
      'TERMINAL_UPDATED',
    ]);

    const terminals = await request(app.getHttpServer())
      .get('/terminals')
      .expect(200);
    expect(
      terminals.body.some((item: any) => item.id === terminalId),
    ).toBe(true);
  });

  it('receives a package and updates warehouse inventory', async () => {
    const terminal = await createTerminal(unique('RCV'));
    const terminalId = terminal.body.terminal.id;
    const trackingNumber = packageIdentifier();

    await request(app.getHttpServer())
      .post('/package-events')
      .send({
        trackingNumber,
        eventType: 'PACKAGE_RECEIVED',
      })
      .expect(201);

    const received = await request(app.getHttpServer())
      .post(`/terminals/${terminalId}/assets`)
      .send({
        assetType: TerminalAssetType.PACKAGE,
        assetIdentifier: trackingNumber,
      })
      .expect(201);

    expect(received.body.snapshot.packageCount).toBe(1);
    expect(received.body.event.eventType).toBe(
      TerminalEventType.PACKAGE_RECEIVED,
    );

    const warehouse = await request(app.getHttpServer())
      .get(`/terminals/${terminalId}/warehouse`)
      .expect(200);
    expect(warehouse.body.packageCount).toBe(1);
    expect(warehouse.body.packages[0].trackingNumber).toBe(trackingNumber);
  });

  it('rejects duplicate asset receipt', async () => {
    const terminal = await createTerminal(unique('DUP-RCV'));
    const terminalId = terminal.body.terminal.id;
    const trackingNumber = packageIdentifier();

    await request(app.getHttpServer()).post('/package-events').send({
      trackingNumber,
      eventType: 'PACKAGE_RECEIVED',
    });

    await request(app.getHttpServer())
      .post(`/terminals/${terminalId}/assets`)
      .send({
        assetType: 'PACKAGE',
        assetIdentifier: trackingNumber,
      })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/terminals/${terminalId}/assets`)
      .send({
        assetType: 'PACKAGE',
        assetIdentifier: trackingNumber,
      })
      .expect(409);
  });

  it('transfers a package and updates both snapshots with correlated events', async () => {
    const source = await createTerminal(unique('SRC'));
    const destination = await createTerminal(unique('DST'));
    const sourceId = source.body.terminal.id;
    const destinationId = destination.body.terminal.id;
    const trackingNumber = packageIdentifier();

    await request(app.getHttpServer()).post('/package-events').send({
      trackingNumber,
      eventType: 'PACKAGE_RECEIVED',
    });
    await request(app.getHttpServer())
      .post(`/terminals/${sourceId}/assets`)
      .send({
        assetType: 'PACKAGE',
        assetIdentifier: trackingNumber,
      })
      .expect(201);

    const transferred = await request(app.getHttpServer())
      .post(`/terminals/${sourceId}/transfer`)
      .send({
        assetType: 'PACKAGE',
        assetIdentifier: trackingNumber,
        destinationTerminalId: destinationId,
      })
      .expect(201);

    expect(transferred.body.sourceSnapshot.packageCount).toBe(0);
    expect(transferred.body.destinationSnapshot.packageCount).toBe(1);
    expect(transferred.body.events).toHaveLength(2);
    expect(transferred.body.events[0].correlationId).toBe(
      transferred.body.events[1].correlationId,
    );

    const packageSnapshot = await prisma.packageSnapshot.findUnique({
      where: { trackingNumber },
    });
    expect(packageSnapshot?.currentTerminalId).toBe(destinationId);
  });

  it('moves trailer contents atomically between terminals', async () => {
    const source = await createTerminal(unique('TR-SRC'));
    const destination = await createTerminal(unique('TR-DST'));
    const sourceId = source.body.terminal.id;
    const destinationId = destination.body.terminal.id;
    const trackingNumber = packageIdentifier();
    const containerBarcode = containerIdentifier();
    const trailerBarcode = trailerIdentifier();

    await request(app.getHttpServer()).post('/package-events').send({
      trackingNumber,
      eventType: 'PACKAGE_RECEIVED',
    });
    const container = await request(app.getHttpServer())
      .post('/containers')
      .send({ containerBarcode })
      .expect(201);
    const trailer = await request(app.getHttpServer())
      .post('/trailers')
      .send({ trailerBarcode })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/containers/${container.body.snapshot.id}/load-package`)
      .send({ trackingNumber })
      .expect(201);
    await request(app.getHttpServer())
      .post(`/trailers/${trailer.body.snapshot.id}/load-container`)
      .send({ containerBarcode })
      .expect(201);
    await request(app.getHttpServer())
      .post(`/terminals/${sourceId}/assets`)
      .send({
        assetType: 'TRAILER',
        assetIdentifier: trailerBarcode,
      })
      .expect(201);

    const transferred = await request(app.getHttpServer())
      .post(`/terminals/${sourceId}/transfer`)
      .send({
        assetType: 'TRAILER',
        assetIdentifier: trailerBarcode,
        destinationTerminalId: destinationId,
      })
      .expect(201);

    expect(transferred.body.movedInventory).toEqual({
      packageCount: 1,
      containerCount: 1,
      trailerCount: 1,
    });
    expect(transferred.body.sourceSnapshot).toMatchObject({
      packageCount: 0,
      containerCount: 0,
      trailerCount: 0,
    });
    expect(transferred.body.destinationSnapshot).toMatchObject({
      packageCount: 1,
      containerCount: 1,
      trailerCount: 1,
    });
  });

  it('returns inventory, yard, and operations views', async () => {
    const terminal = await createTerminal(unique('VIEWS'));
    const terminalId = terminal.body.terminal.id;

    const inventory = await request(app.getHttpServer())
      .get(`/terminals/${terminalId}/inventory`)
      .expect(200);
    expect(inventory.body.snapshot).toBeDefined();

    const yard = await request(app.getHttpServer())
      .get(`/terminals/${terminalId}/yard`)
      .expect(200);
    expect(yard.body.trailerCount).toBe(0);

    const operations = await request(app.getHttpServer())
      .get(`/terminals/${terminalId}/operations`)
      .expect(200);
    expect(operations.body.status).toBe('ACTIVE');
    expect(operations.body.recentEvents[0].eventType).toBe(
      'TERMINAL_CREATED',
    );
  });

  it('prevents closed terminals from processing assets', async () => {
    const terminal = await createTerminal(unique('CLOSED'));
    const terminalId = terminal.body.terminal.id;
    const trackingNumber = packageIdentifier();

    await request(app.getHttpServer())
      .patch(`/terminals/${terminalId}`)
      .send({ status: 'CLOSED' })
      .expect(200);
    await request(app.getHttpServer()).post('/package-events').send({
      trackingNumber,
      eventType: 'PACKAGE_RECEIVED',
    });

    await request(app.getHttpServer())
      .post(`/terminals/${terminalId}/assets`)
      .send({
        assetType: 'PACKAGE',
        assetIdentifier: trackingNumber,
      })
      .expect(400);
  });

  it('returns 404 for an unknown terminal', async () => {
    await request(app.getHttpServer()).get('/terminals/2147483647').expect(404);
  });
});
