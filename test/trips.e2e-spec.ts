import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaClient } from '@prisma/client';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaExceptionFilter } from '../src/common/filters/prisma-exception.filter';

const prisma = new PrismaClient();

describe('Trips (e2e)', () => {
  let app: INestApplication;
  let sequence = 0;
  const unique = (prefix: string) => `${prefix}-${Date.now().toString(36)}-${sequence++}`;
  const terminal = async () => (await request(app.getHttpServer()).post('/terminals').send({ terminalCode: unique('TT'), name: 'Trip terminal', city: 'Calgary', province: 'Alberta', country: 'Canada', timezone: 'America/Edmonton' }).expect(201)).body.terminal.id as number;

  beforeAll(async () => {
    const fixture = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = fixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    app.useGlobalFilters(new PrismaExceptionFilter());
    await app.init();
  });
  afterAll(async () => { await app.close(); await prisma.$disconnect(); });

  it('executes route stops in sequence and completes with events and snapshots', async () => {
    const originTerminalId = await terminal(); const middleTerminalId = await terminal(); const destinationTerminalId = await terminal();
    const route = (await request(app.getHttpServer()).post('/routes').send({ routeNumber: unique('R'), name: 'Trip route', originTerminalId, destinationTerminalId, estimatedDuration: 120 }).expect(201)).body.route;
    await request(app.getHttpServer()).post(`/routes/${route.id}/stops`).send({ terminalId: middleTerminalId, estimatedArrivalOffset: 50, estimatedDepartureOffset: 60 }).expect(201);
    await request(app.getHttpServer()).post(`/routes/${route.id}/activate`).expect(201);
    const created = await request(app.getHttpServer()).post('/trips').send({ tripNumber: unique('TRIP'), routeId: route.id, plannedDeparture: new Date(Date.now() + 3600000).toISOString() }).expect(201);
    const tripId = created.body.trip.id;
    expect(created.body.stops).toHaveLength(3); expect(created.body.event.eventType).toBe('TRIP_CREATED'); expect(created.body.snapshot.totalStops).toBe(3);
    await request(app.getHttpServer()).post(`/trips/${tripId}/start`).expect(201);
    await request(app.getHttpServer()).post(`/trips/${tripId}/stops/${created.body.stops[1].id}/arrive`).send({}).expect(409);
    for (const stop of created.body.stops) {
      await request(app.getHttpServer()).post(`/trips/${tripId}/stops/${stop.id}/arrive`).send({}).expect(201);
      await request(app.getHttpServer()).post(`/trips/${tripId}/stops/${stop.id}/depart`).send({}).expect(201);
    }
    const completed = await request(app.getHttpServer()).post(`/trips/${tripId}/complete`).expect(201);
    expect(completed.body.snapshot).toMatchObject({ currentStatus: 'COMPLETED', progressPercent: 100 });
    const events = await prisma.tripEvent.findMany({ where: { tripId }, orderBy: { createdAt: 'asc' } });
    expect(events.map((event) => event.eventType)).toEqual(['TRIP_CREATED', 'TRIP_STARTED', 'STOP_ARRIVED', 'STOP_DEPARTED', 'STOP_ARRIVED', 'STOP_DEPARTED', 'STOP_ARRIVED', 'STOP_DEPARTED', 'TRIP_COMPLETED']);
  });
});
