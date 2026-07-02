import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaClient } from '@prisma/client';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaExceptionFilter } from '../src/common/filters/prisma-exception.filter';

const prisma = new PrismaClient();

describe('Routes (e2e)', () => {
  let app: INestApplication;
  let sequence = 0;
  const unique = (prefix: string) =>
    `${prefix}-${Date.now().toString(36)}-${sequence++}`;

  const createTerminal = async () => {
    const code = unique('RT');
    const response = await request(app.getHttpServer())
      .post('/terminals')
      .send({
        terminalCode: code,
        name: `${code} Terminal`,
        city: 'Calgary',
        province: 'Alberta',
        country: 'Canada',
        timezone: 'America/Edmonton',
      })
      .expect(201);
    return response.body.terminal.id as number;
  };

  const createRoute = async () => {
    const originTerminalId = await createTerminal();
    const destinationTerminalId = await createTerminal();
    const routeNumber = unique('AB');
    const response = await request(app.getHttpServer())
      .post('/routes')
      .send({
        routeNumber,
        name: 'Calgary to Edmonton',
        originTerminalId,
        destinationTerminalId,
        estimatedDistance: 300,
        estimatedDuration: 180,
      })
      .expect(201);
    return { response, originTerminalId, destinationTerminalId, routeNumber };
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
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

  it('creates, reads, lists, and updates a route with events and snapshots', async () => {
    const { response, routeNumber } = await createRoute();
    const routeId = response.body.route.id;
    expect(response.body.route.routeNumber).toBe(routeNumber.toUpperCase());
    expect(response.body.event.eventType).toBe('ROUTE_CREATED');
    expect(response.body.snapshot).toMatchObject({
      currentStatus: 'CREATED',
      stopCount: 0,
      currentStops: [],
    });

    const updated = await request(app.getHttpServer())
      .patch(`/routes/${routeId}`)
      .send({ name: 'Updated Alberta Route', estimatedDuration: 190 })
      .expect(200);
    expect(updated.body.route.name).toBe('Updated Alberta Route');
    expect(updated.body.snapshot.estimatedDuration).toBe(190);
    expect(updated.body.event.eventType).toBe('ROUTE_UPDATED');

    const route = await request(app.getHttpServer())
      .get(`/routes/${routeId}`)
      .expect(200);
    expect(route.body.originTerminal).toBeDefined();
    expect(route.body.destinationTerminal).toBeDefined();

    const routes = await request(app.getHttpServer()).get('/routes').expect(200);
    expect(routes.body.some((item: any) => item.id === routeId)).toBe(true);

    const events = await prisma.routeEvent.findMany({ where: { routeId } });
    expect(events.map((event) => event.eventType)).toEqual([
      'ROUTE_CREATED',
      'ROUTE_UPDATED',
    ]);
  });

  it('orders stops, prevents duplicates, and resequences after removal', async () => {
    const { response } = await createRoute();
    const routeId = response.body.route.id;
    const firstTerminalId = await createTerminal();
    const insertedTerminalId = await createTerminal();

    const first = await request(app.getHttpServer())
      .post(`/routes/${routeId}/stops`)
      .send({
        terminalId: firstTerminalId,
        estimatedArrivalOffset: 90,
        estimatedDepartureOffset: 100,
      })
      .expect(201);
    expect(first.body.snapshot.stopCount).toBe(1);

    const inserted = await request(app.getHttpServer())
      .post(`/routes/${routeId}/stops`)
      .send({
        terminalId: insertedTerminalId,
        sequence: 1,
        estimatedArrivalOffset: 40,
        estimatedDepartureOffset: 50,
      })
      .expect(201);
    expect(inserted.body.snapshot.currentStops).toEqual([
      expect.objectContaining({ terminalId: insertedTerminalId, sequence: 1 }),
      expect.objectContaining({ terminalId: firstTerminalId, sequence: 2 }),
    ]);

    await request(app.getHttpServer())
      .post(`/routes/${routeId}/stops`)
      .send({
        terminalId: insertedTerminalId,
        estimatedArrivalOffset: 120,
        estimatedDepartureOffset: 130,
      })
      .expect(409);

    const removed = await request(app.getHttpServer())
      .delete(`/routes/${routeId}/stops/${inserted.body.stop.id}`)
      .expect(200);
    expect(removed.body.snapshot.currentStops).toEqual([
      expect.objectContaining({ terminalId: firstTerminalId, sequence: 1 }),
    ]);
    expect(removed.body.event.eventType).toBe('STOP_REMOVED');
  });

  it('enforces route lifecycle and makes retired routes immutable', async () => {
    const { response } = await createRoute();
    const routeId = response.body.route.id;

    await request(app.getHttpServer())
      .post(`/routes/${routeId}/retire`)
      .expect(409);

    const activated = await request(app.getHttpServer())
      .post(`/routes/${routeId}/activate`)
      .expect(201);
    expect(activated.body.snapshot.currentStatus).toBe('ACTIVE');
    expect(activated.body.event.eventType).toBe('ROUTE_ACTIVATED');

    const retired = await request(app.getHttpServer())
      .post(`/routes/${routeId}/retire`)
      .expect(201);
    expect(retired.body.snapshot.currentStatus).toBe('RETIRED');
    expect(retired.body.event.eventType).toBe('ROUTE_RETIRED');

    await request(app.getHttpServer())
      .patch(`/routes/${routeId}`)
      .send({ name: 'Forbidden update' })
      .expect(409);
  });

  it('rejects duplicate route numbers and invalid terminal combinations', async () => {
    const { routeNumber, originTerminalId, destinationTerminalId } =
      await createRoute();

    await request(app.getHttpServer())
      .post('/routes')
      .send({
        routeNumber,
        name: 'Duplicate',
        originTerminalId,
        destinationTerminalId,
      })
      .expect(409);

    await request(app.getHttpServer())
      .post('/routes')
      .send({
        routeNumber: unique('BAD'),
        name: 'Invalid',
        originTerminalId,
        destinationTerminalId: originTerminalId,
      })
      .expect(400);
  });
});
