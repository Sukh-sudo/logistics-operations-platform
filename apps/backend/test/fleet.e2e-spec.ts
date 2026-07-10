import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaClient } from '@prisma/client';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaExceptionFilter } from '../src/common/filters/prisma-exception.filter';

const prisma = new PrismaClient();

describe('Fleet (e2e)', () => {
  let app: INestApplication;
  let sequence = 0;
  const unique = (prefix: string) =>
    `${prefix}-${Date.now().toString(36)}-${sequence++}`;

  const createTerminal = async () => {
    const code = unique('FLT');
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

  it('creates, reads, and lists trucks with fleet events and snapshots', async () => {
    const terminalId = await createTerminal();
    const unitNumber = unique('TRK');
    const licensePlate = unique('PLT');

    const created = await request(app.getHttpServer())
      .post('/fleet/trucks')
      .send({
        unitNumber,
        licensePlate,
        terminalId,
        year: 2024,
        make: 'Freightliner',
        model: 'Cascadia',
      })
      .expect(201);

    expect(created.body.truck.unitNumber).toBe(unitNumber.toUpperCase());
    expect(created.body.event.eventType).toBe('TRUCK_CREATED');
    expect(created.body.snapshot).toMatchObject({
      currentStatus: 'AVAILABLE',
      currentTerminalId: terminalId,
    });

    const truckId = created.body.truck.id;
    const truck = await request(app.getHttpServer())
      .get(`/fleet/trucks/${truckId}`)
      .expect(200);
    expect(truck.body.snapshot.currentStatus).toBe('AVAILABLE');

    const trucks = await request(app.getHttpServer())
      .get('/fleet/trucks')
      .expect(200);
    expect(trucks.body.some((item: any) => item.id === truckId)).toBe(true);

    const events = await prisma.fleetEvent.findMany({ where: { truckId } });
    expect(events.map((event) => event.eventType)).toEqual(['TRUCK_CREATED']);
  });

  it('creates, reads, and lists drivers with fleet events and snapshots', async () => {
    const terminalId = await createTerminal();
    const employeeId = unique('DRV');
    const licenseNumber = unique('LIC');

    const created = await request(app.getHttpServer())
      .post('/fleet/drivers')
      .send({
        employeeId,
        licenseNumber,
        licenseClass: 'Class 1',
        terminalId,
      })
      .expect(201);

    expect(created.body.driver.employeeId).toBe(employeeId.toUpperCase());
    expect(created.body.event.eventType).toBe('DRIVER_CREATED');
    expect(created.body.snapshot).toMatchObject({
      currentStatus: 'AVAILABLE',
      currentTerminalId: terminalId,
    });

    const driverId = created.body.driver.id;
    const driver = await request(app.getHttpServer())
      .get(`/fleet/drivers/${driverId}`)
      .expect(200);
    expect(driver.body.snapshot.currentStatus).toBe('AVAILABLE');

    const drivers = await request(app.getHttpServer())
      .get('/fleet/drivers')
      .expect(200);
    expect(drivers.body.some((item: any) => item.id === driverId)).toBe(true);

    const events = await prisma.fleetEvent.findMany({ where: { driverId } });
    expect(events.map((event) => event.eventType)).toEqual(['DRIVER_CREATED']);
  });

  it('rejects duplicate fleet identifiers and missing terminals', async () => {
    const terminalId = await createTerminal();
    const unitNumber = unique('DUPTRK');

    await request(app.getHttpServer())
      .post('/fleet/trucks')
      .send({ unitNumber, licensePlate: unique('DUPPLT'), terminalId })
      .expect(201);

    await request(app.getHttpServer())
      .post('/fleet/trucks')
      .send({ unitNumber, licensePlate: unique('DUPPLT'), terminalId })
      .expect(409);

    await request(app.getHttpServer())
      .post('/fleet/drivers')
      .send({
        employeeId: unique('BADDRV'),
        licenseNumber: unique('BADLIC'),
        licenseClass: 'Class 1',
        terminalId: 999999,
      })
      .expect(404);
  });
});
