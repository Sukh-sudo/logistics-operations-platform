import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaClient, TruckPurpose } from '@prisma/client';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaExceptionFilter } from '../src/common/filters/prisma-exception.filter';
import { trailerIdentifier } from './support/asset-identifiers';
import { containerIdentifier, packageIdentifier } from './support/asset-identifiers';
import { createOperationalTestingModule } from './support/operational-testing-module';

const prisma = new PrismaClient();

describe('Trips (e2e)', () => {
  let app: INestApplication;
  let sequence = 0;
  let terminalSequence = 0;
  const unique = (prefix: string) => `${prefix}-${Date.now().toString(36)}-${sequence++}`;
  const terminal = async () => {
    let terminalCode: string | undefined;
    const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    // Trip fixtures also need terminal codes that satisfy fleet unit numbering.
    while (!terminalCode && terminalSequence < letters.length * letters.length) {
      const current = terminalSequence++;
      const candidate = `T${letters[Math.floor(current / letters.length)]}${letters[current % letters.length]}`;
      const existing = await prisma.terminal.findUnique({ where: { terminalCode: candidate } });
      if (!existing) terminalCode = candidate;
    }
    if (!terminalCode) throw new Error('Trip test terminal code space is exhausted');
    return (await request(app.getHttpServer()).post('/terminals').send({ terminalCode, city: 'Calgary', province: 'Alberta', country: 'Canada', timezone: 'America/Edmonton' }).expect(201)).body.terminal.id as number;
  };

  beforeAll(async () => {
    const fixture = await createOperationalTestingModule();
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
    const truck = (await request(app.getHttpServer()).post('/fleet/trucks').send({ purpose: TruckPurpose.MIDDLE_MILE, licensePlate: unique('PLT'), terminalId: originTerminalId }).expect(201)).body.truck;
    const driver = (await request(app.getHttpServer()).post('/fleet/drivers').send({ employeeId: unique('DRV'), licenseNumber: unique('LIC'), licenseClass: 'Class 1', terminalId: originTerminalId }).expect(201)).body.driver;
    // Trailer fixtures must satisfy the documented TRLR + six digits identifier format.
    const trailer = (await request(app.getHttpServer()).post('/trailers').send({ trailerBarcode: trailerIdentifier(), terminalId: originTerminalId }).expect(201)).body.snapshot;
    const trackingNumber = packageIdentifier();
    await request(app.getHttpServer())
      .post('/package-events')
      .send({
        trackingNumber,
        eventType: 'PACKAGE_RECEIVED',
        terminalId: originTerminalId,
      })
      .expect(201);
    await request(app.getHttpServer())
      .post('/package-events')
      .send({
        trackingNumber,
        eventType: 'PACKAGE_SORTED',
        terminalId: originTerminalId,
      })
      .expect(201);
    const container = (await request(app.getHttpServer())
      .post('/containers')
      .send({
        containerBarcode: containerIdentifier(),
        terminalId: originTerminalId,
      })
      .expect(201)).body.snapshot;
    await request(app.getHttpServer())
      .post(`/containers/${container.id}/load-package`)
      .send({ trackingNumber })
      .expect(201);
    await request(app.getHttpServer())
      .post(`/trailers/${trailer.id}/load-container`)
      .send({ containerBarcode: container.containerBarcode })
      .expect(201);
    await request(app.getHttpServer())
      .post('/shipments')
      .send({
        shipmentNumber: unique('TRIP-SHIP'),
        originTerminalId,
        destinationTerminalId,
        packageTrackingNumbers: [trackingNumber],
      })
      .expect(201);
    await request(app.getHttpServer()).post('/fleet/assignments').send({ tripId, truckId: truck.id, driverId: driver.id, trailerId: trailer.id }).expect(201);
    const started = await request(app.getHttpServer()).post(`/trips/${tripId}/start`).expect(201);
    const departedPackage = await prisma.packageSnapshot.findUniqueOrThrow({
      where: { trackingNumber },
    });
    const departedContainer = await prisma.containerSnapshot.findUniqueOrThrow({
      where: { id: container.id },
    });
    expect(departedPackage).toMatchObject({
      currentStatus: 'DEPARTED',
      currentTerminalId: null,
    });
    expect(departedContainer).toMatchObject({
      currentStatus: 'IN_TRANSIT',
      currentTerminalId: null,
    });
    const correlatedDepartureEvents = await Promise.all([
      prisma.packageEvent.findFirstOrThrow({
        where: { packageId: departedPackage.id, eventType: 'PACKAGE_DEPARTED' },
      }),
      prisma.containerEvent.findFirstOrThrow({
        where: { containerId: container.id, eventType: 'CONTAINER_DEPARTED' },
      }),
      prisma.trailerEvent.findFirstOrThrow({
        where: { trailerId: trailer.id, eventType: 'TRAILER_DEPARTED' },
      }),
    ]);
    expect(
      correlatedDepartureEvents.every(
        (event) => event.correlationId === started.body.event.correlationId,
      ),
    ).toBe(true);
    await request(app.getHttpServer()).post(`/trips/${tripId}/stops/${created.body.stops[1].id}/arrive`).send({}).expect(409);
    for (const stop of created.body.stops) {
      await request(app.getHttpServer()).post(`/trips/${tripId}/stops/${stop.id}/arrive`).send({}).expect(201);
      await request(app.getHttpServer()).post(`/trips/${tripId}/stops/${stop.id}/depart`).send({}).expect(201);
    }
    const completed = await request(app.getHttpServer()).post(`/trips/${tripId}/complete`).expect(201);
    expect(completed.body.snapshot).toMatchObject({ currentStatus: 'COMPLETED', progressPercent: 100 });
    expect(completed.body.fleet).toMatchObject({ truckSnapshot: { currentStatus: 'AVAILABLE', assignedTripId: null, currentTerminalId: destinationTerminalId }, driverSnapshot: { currentStatus: 'AVAILABLE', assignedTripId: null, currentTerminalId: destinationTerminalId }, trailerSnapshot: { currentStatus: 'ARRIVED', currentTerminalId: destinationTerminalId } });
    const events = await prisma.tripEvent.findMany({ where: { tripId }, orderBy: { createdAt: 'asc' } });
    expect(events.map((event) => event.eventType)).toEqual(['TRIP_CREATED', 'TRIP_STARTED', 'STOP_ARRIVED', 'STOP_DEPARTED', 'STOP_ARRIVED', 'STOP_DEPARTED', 'STOP_ARRIVED', 'STOP_DEPARTED', 'TRIP_COMPLETED']);

    const destinationSnapshot =
      await prisma.terminalSnapshot.findUniqueOrThrow({
        where: { terminalId: destinationTerminalId },
      });
    expect(destinationSnapshot).toMatchObject({
      packageCount: 1,
      containerCount: 1,
      trailerCount: 1,
      truckCount: 1,
    });

    // Prove that legacy physical-asset snapshots are disposable read models.
    await request(app.getHttpServer()).post('/snapshots/rebuild').expect(201);
    const rebuiltPackage = await prisma.packageSnapshot.findUniqueOrThrow({
      where: { trackingNumber },
    });
    const rebuiltContainer = await prisma.containerSnapshot.findUniqueOrThrow({
      where: { id: container.id },
    });
    expect(rebuiltPackage).toMatchObject({
      currentStatus: 'ARRIVED',
      currentTerminalId: destinationTerminalId,
      currentContainerId: container.id,
    });
    expect(rebuiltContainer).toMatchObject({
      currentStatus: 'ARRIVED',
      currentTerminalId: destinationTerminalId,
      currentTrailerId: trailer.id,
      packageCount: 1,
    });
  });
});
