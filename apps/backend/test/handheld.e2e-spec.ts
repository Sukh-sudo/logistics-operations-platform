import { INestApplication } from '@nestjs/common';
import {
  HandheldAction,
  HandheldNetworkState,
  HandheldResultStatus,
  HandheldTaskType,
  PackageEventType,
  TruckPurpose,
  UserStatus,
} from '@prisma/client';
import { TestingModule } from '@nestjs/testing';
import { randomUUID } from 'crypto';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/infrastructure/prisma/prisma.service';
import { HandheldService } from '../src/modules/handheld/services/handheld.service';
import { ContainerService } from '../src/modules/containers/services/container.service';
import { FleetService } from '../src/modules/fleet/services/fleet.service';
import { PackageService } from '../src/modules/packages/services/package.service';
import { TerminalService } from '../src/modules/terminals/services/terminal.service';
import { TrailerService } from '../src/modules/trailers/services/trailer.service';
import { RouteService } from '../src/modules/routes/services/route.service';
import { UserService } from '../src/modules/users/services/user.service';
import {
  packageIdentifier,
  containerIdentifier,
  trailerIdentifier,
} from './support/asset-identifiers';
import { createOperationalTestingModule } from './support/operational-testing-module';

describe('Handheld transactional workflow (integration)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let handheld: HandheldService;
  let employeeId: string;
  let terminalId: number;
  let sessionId: string;
  let trackingNumber: string;
  let trailerBarcode: string;
  let badgeBarcode: string;
  let employeeNumber: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule =
      await createOperationalTestingModule();
    app = moduleFixture.createNestApplication();
    await app.init();

    prisma = app.get(PrismaService);
    handheld = app.get(HandheldService);
    const terminals = app.get(TerminalService);
    const users = app.get(UserService);
    const packages = app.get(PackageService);
    const trailers = app.get(TrailerService);
    const suffix = `${Date.now()}${Math.floor(Math.random() * 1000)}`;

    const terminal = await terminals.createTerminal({
      terminalCode: threeLetterTerminalCode(),
      city: 'Calgary',
      province: 'Alberta',
      country: 'Canada',
      timezone: 'America/Edmonton',
    });
    terminalId = terminal.terminal.id;
    employeeNumber = `HH-${suffix}`;
    badgeBarcode = `BADGE-${suffix}`;
    const employee = await users.createUser({
      employeeNumber,
      badgeBarcode,
      email: `handheld-${suffix}@example.com`,
      firstName: 'Handheld',
      lastName: 'Operator',
      password: 'HandheldTest!123',
      status: UserStatus.ACTIVE,
    });
    employeeId = employee.user.id;
    const handheldRole = await prisma.role.upsert({
      where: { name: 'FORKLIFT_OPERATOR' },
      update: {},
      create: {
        name: 'FORKLIFT_OPERATOR',
        description: 'Authorized terminal handheld operator',
      },
    });
    // Assign through the domain service so the user event and snapshot agree.
    await users.assignRole(employeeId, handheldRole.id);
    await users.assignTerminal(employeeId, terminalId);

    trackingNumber = packageIdentifier();
    await packages.createPackageEvent({
      trackingNumber,
      eventType: PackageEventType.PACKAGE_RECEIVED,
      terminalId,
    });
    await packages.createPackageEvent({
      trackingNumber,
      eventType: PackageEventType.PACKAGE_SORTED,
      terminalId,
    });
    trailerBarcode = trailerIdentifier();
    await trailers.createTrailer({ trailerBarcode, terminalId });

    const session = await handheld.startSession(employeeId, {
      deviceId: '8c808770-d3c8-4891-8382-f700e919aec3',
      taskType: HandheldTaskType.TRAILER_LOAD,
      networkState: HandheldNetworkState.ONLINE,
    });
    sessionId = session.session.id;
  });

  it('authenticates a badge and resolves the permanent terminal', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/mobile/v1/auth/login')
      .send({
        badgeBarcode,
        employeeId: employeeNumber,
        deviceId: '8c808770-d3c8-4891-8382-f700e919aec3',
      })
      .expect(201);

    expect(response.body.accessToken).toBeDefined();
    expect(response.body.employee.id).toBe(employeeId);
    expect(response.body.terminal.id).toBe(terminalId);
  });

  afterAll(async () => {
    await app.close();
  });

  it('writes the domain event, package snapshot, and idempotent receipt', async () => {
    const command = {
      taskSessionId: sessionId,
      clientEventId: randomUUID(),
      action: HandheldAction.LOAD_PACKAGE_TO_TRAILER,
      deviceId: '8c808770-d3c8-4891-8382-f700e919aec3',
      deviceTimestamp: new Date().toISOString(),
      networkStateAtCapture: HandheldNetworkState.ONLINE,
      trackingNumber,
      trailerBarcode,
    };

    const accepted = await handheld.processScan(
      sessionId,
      employeeId,
      command,
    );
    const duplicate = await handheld.processScan(
      sessionId,
      employeeId,
      command,
    );
    const snapshot = await prisma.packageSnapshot.findUniqueOrThrow({
      where: { trackingNumber },
    });
    const events = await prisma.packageEvent.count({
      where: {
        packageId: snapshot.id,
        eventType: PackageEventType.PACKAGE_LOADED_TO_TRAILER,
      },
    });

    expect(accepted.resultStatus).toBe(HandheldResultStatus.ACCEPTED);
    expect(duplicate.resultStatus).toBe(
      HandheldResultStatus.DUPLICATE_ACCEPTED,
    );
    expect(snapshot.currentStatus).toBe('IN_TRAILER');
    expect(events).toBe(1);
  });

  it('closes a container before atomically loading it onto the selected trailer', async () => {
    const containers = app.get(ContainerService);
    const created = await containers.createContainer({
      containerBarcode: containerIdentifier(),
      terminalId,
    });
    const closeSession = await handheld.startSession(employeeId, {
      deviceId: '8c808770-d3c8-4891-8382-f700e919aec3',
      taskType: HandheldTaskType.CONTAINER_LOAD,
      networkState: HandheldNetworkState.ONLINE,
    });
    await handheld.processScan(closeSession.session.id, employeeId, {
      taskSessionId: closeSession.session.id,
      clientEventId: randomUUID(),
      action: HandheldAction.CLOSE_CONTAINER,
      deviceId: '8c808770-d3c8-4891-8382-f700e919aec3',
      deviceTimestamp: new Date().toISOString(),
      networkStateAtCapture: HandheldNetworkState.ONLINE,
      containerBarcode: created.snapshot.containerBarcode,
    });
    const loaded = await handheld.processScan(sessionId, employeeId, {
      taskSessionId: sessionId,
      clientEventId: randomUUID(),
      action: HandheldAction.LOAD_CONTAINER_TO_TRAILER,
      deviceId: '8c808770-d3c8-4891-8382-f700e919aec3',
      deviceTimestamp: new Date().toISOString(),
      networkStateAtCapture: HandheldNetworkState.ONLINE,
      containerBarcode: created.snapshot.containerBarcode,
      trailerBarcode,
    });
    const snapshot = await prisma.containerSnapshot.findUniqueOrThrow({
      where: { id: created.snapshot.id },
    });

    expect(loaded.resultStatus).toBe(HandheldResultStatus.ACCEPTED);
    expect(snapshot.currentStatus).toBe('CLOSED');
    expect(snapshot.currentTrailerId).not.toBeNull();
  });

  it('records and reverses a last-mile route/truck package assignment', async () => {
    const terminals = app.get(TerminalService);
    const routes = app.get(RouteService);
    const fleet = app.get(FleetService);
    const packages = app.get(PackageService);
    const suffix = `${Date.now()}${Math.floor(Math.random() * 1000)}`;
    const destination = await terminals.createTerminal({
      terminalCode: threeLetterTerminalCode(),
      city: 'Edmonton',
      province: 'Alberta',
      country: 'Canada',
      timezone: 'America/Edmonton',
    });
    const route = await routes.createRoute({
      routeNumber: `LM-${suffix}`,
      name: 'Handheld last mile',
      originTerminalId: terminalId,
      destinationTerminalId: destination.terminal.id,
    });
    const truck = await fleet.createTruck({
      purpose: TruckPurpose.LAST_MILE,
      licensePlate: `LM-${suffix}`,
      terminalId,
    });
    const packageNumber = packageIdentifier();
    await packages.createPackageEvent({
      trackingNumber: packageNumber,
      eventType: PackageEventType.PACKAGE_RECEIVED,
      terminalId,
    });
    await packages.createPackageEvent({
      trackingNumber: packageNumber,
      eventType: PackageEventType.PACKAGE_SORTED,
      terminalId,
    });
    const lastMileSession = await handheld.startSession(employeeId, {
      deviceId: '8c808770-d3c8-4891-8382-f700e919aec3',
      taskType: HandheldTaskType.LAST_MILE_LOADING,
      networkState: HandheldNetworkState.ONLINE,
    });
    const base = {
      taskSessionId: lastMileSession.session.id,
      deviceId: '8c808770-d3c8-4891-8382-f700e919aec3',
      deviceTimestamp: new Date().toISOString(),
      networkStateAtCapture: HandheldNetworkState.ONLINE,
      trackingNumber: packageNumber,
      routeCode: route.route.routeNumber,
      truckUnitNumber: truck.truck.unitNumber,
    };
    await handheld.processScan(lastMileSession.session.id, employeeId, {
      ...base,
      clientEventId: randomUUID(),
      action: HandheldAction.LOAD_PACKAGE_TO_ROUTE,
    });
    await handheld.processScan(lastMileSession.session.id, employeeId, {
      ...base,
      clientEventId: randomUUID(),
      action: HandheldAction.REMOVE_PACKAGE_FROM_ROUTE,
    });
    const snapshot = await prisma.packageSnapshot.findUniqueOrThrow({
      where: { trackingNumber: packageNumber },
    });

    expect(snapshot.currentRouteId).toBeNull();
    expect(snapshot.currentTruckId).toBeNull();
    expect(
      await prisma.packageEvent.count({
        where: {
          packageId: snapshot.id,
          eventType: {
            in: [
              PackageEventType.PACKAGE_LOADED_TO_LAST_MILE,
              PackageEventType.PACKAGE_REMOVED_FROM_LAST_MILE,
            ],
          },
        },
      }),
    ).toBe(2);
  });
});

function threeLetterTerminalCode() {
  return Array.from({ length: 3 }, () =>
    String.fromCharCode(65 + Math.floor(Math.random() * 26)),
  ).join('');
}
