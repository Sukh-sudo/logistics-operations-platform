import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PackageStatus, PrismaClient } from '@prisma/client';
import request from 'supertest';
import { packageIdentifier } from './support/asset-identifiers';
import { AppModule } from '../src/app.module';
import { PrismaExceptionFilter } from '../src/common/filters/prisma-exception.filter';

const prisma = new PrismaClient();

describe('Shipments (e2e)', () => {
  let app: INestApplication;
  let sequence = 0;
  const unique = (prefix: string) => `${prefix}-${Date.now().toString(36)}-${sequence++}`;
  const terminal = async () => (await request(app.getHttpServer()).post('/terminals').send({ terminalCode: unique('ST'), city: 'Edmonton', province: 'Alberta', country: 'Canada', timezone: 'America/Edmonton' }).expect(201)).body.terminal.id as number;
  const pkg = async () => { const trackingNumber = packageIdentifier(); await request(app.getHttpServer()).post('/package-events').send({ trackingNumber, eventType: 'PACKAGE_RECEIVED' }).expect(201); return trackingNumber; };

  beforeAll(async () => {
    const fixture = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = fixture.createNestApplication(); app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true })); app.useGlobalFilters(new PrismaExceptionFilter()); await app.init();
  });
  afterAll(async () => { await app.close(); await prisma.$disconnect(); });

  it('manages package membership and completes only after delivery', async () => {
    const originTerminalId = await terminal(); const destinationTerminalId = await terminal(); const first = await pkg(); const second = await pkg();
    const created = await request(app.getHttpServer()).post('/shipments').send({ shipmentNumber: unique('SHIP'), referenceNumber: 'ORDER-1', originTerminalId, destinationTerminalId, packageTrackingNumbers: [first] }).expect(201);
    const id = created.body.shipment.id;
    expect(created.body.event.eventType).toBe('SHIPMENT_CREATED'); expect(created.body.snapshot.packageCount).toBe(1);
    const assigned = await request(app.getHttpServer()).post(`/shipments/${id}/assign-package`).send({ trackingNumber: second }).expect(201);
    expect(assigned.body.snapshot.packageCount).toBe(2);
    await request(app.getHttpServer()).post(`/shipments/${id}/complete`).expect(409);
    const removed = await request(app.getHttpServer()).post(`/shipments/${id}/remove-package`).send({ trackingNumber: second }).expect(201);
    expect(removed.body.snapshot.packageCount).toBe(1);
    await request(app.getHttpServer()).post(`/shipments/${id}/remove-package`).send({ trackingNumber: first }).expect(409);
    await prisma.packageSnapshot.update({ where: { trackingNumber: first }, data: { currentStatus: PackageStatus.DELIVERED } });
    const completed = await request(app.getHttpServer()).post(`/shipments/${id}/complete`).expect(201);
    expect(completed.body.snapshot).toMatchObject({ currentStatus: 'COMPLETED', deliveredPackages: 1, remainingPackages: 0, progressPercent: 100 });
    const history = await request(app.getHttpServer()).get(`/shipments/${id}/history`).expect(200);
    expect(history.body.map((event: any) => event.eventType)).toEqual(['SHIPMENT_CREATED', 'PACKAGE_ASSIGNED', 'PACKAGE_REMOVED', 'SHIPMENT_COMPLETED']);
  });
});
