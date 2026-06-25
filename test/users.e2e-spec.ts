import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaClient } from '@prisma/client';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaExceptionFilter } from '../src/common/filters/prisma-exception.filter';

const prisma = new PrismaClient();

describe('Users (e2e)', () => {
  let app: INestApplication;
  let sequence = 0;

  const unique = (prefix: string) =>
    `${prefix}-${Date.now().toString(36)}-${sequence++}`;

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

  it('manages the user lifecycle, roles, permissions, events, and snapshot', async () => {
    const suffix = unique('identity');
    const permission = await request(app.getHttpServer())
      .post('/permissions')
      .send({
        code: `packages.receive.${suffix}`,
        description: 'Receive packages',
      })
      .expect(201);
    const role = await request(app.getHttpServer())
      .post('/roles')
      .send({
        name: `operator ${suffix}`,
        description: 'Terminal operator',
      })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/roles/${role.body.role.id}/permissions`)
      .send({ permissionId: permission.body.permission.id })
      .expect(201);

    const created = await request(app.getHttpServer())
      .post('/users')
      .send({
        employeeNumber: unique('emp'),
        email: `${unique('operator')}@example.com`,
        firstName: 'Taylor',
        lastName: 'Morgan',
      })
      .expect(201);
    const userId = created.body.user.id;

    expect(created.body.snapshot.currentStatus).toBe('INACTIVE');
    expect(created.body.events[0].eventType).toBe('USER_CREATED');

    await request(app.getHttpServer())
      .post(`/users/${userId}/activate`)
      .send({})
      .expect(201);

    const assigned = await request(app.getHttpServer())
      .post(`/users/${userId}/roles`)
      .send({ roleId: role.body.role.id })
      .expect(201);

    expect(assigned.body.snapshot.currentStatus).toBe('ACTIVE');
    expect(assigned.body.snapshot.roleNames).toEqual([
      role.body.role.name,
    ]);
    expect(assigned.body.snapshot.permissions).toEqual([
      permission.body.permission.code,
    ]);
    expect(assigned.body.event.eventType).toBe('ROLE_ASSIGNED');

    const snapshot = await request(app.getHttpServer())
      .get(`/users/${userId}`)
      .expect(200);
    expect(snapshot.body).toMatchObject({
      userId,
      currentStatus: 'ACTIVE',
      roleNames: [role.body.role.name],
      permissions: [permission.body.permission.code],
    });

    const history = await request(app.getHttpServer())
      .get(`/users/${userId}/history`)
      .expect(200);
    expect(history.body.map((event: { eventType: string }) => event.eventType))
      .toEqual(['USER_CREATED', 'USER_ACTIVATED', 'ROLE_ASSIGNED']);

    await request(app.getHttpServer())
      .delete(`/users/${userId}/roles/${role.body.role.id}`)
      .send({})
      .expect(200);
    await request(app.getHttpServer())
      .post(`/users/${userId}/deactivate`)
      .send({})
      .expect(201);

    const finalSnapshot = await prisma.userSnapshot.findUnique({
      where: { userId },
    });
    expect(finalSnapshot).toMatchObject({
      currentStatus: 'INACTIVE',
      roleNames: [],
      permissions: [],
    });
  });

  it('validates input and rejects duplicate users and assignments', async () => {
    await request(app.getHttpServer())
      .post('/users')
      .send({ email: 'not-an-email' })
      .expect(400);

    const employeeNumber = unique('dup-emp');
    const email = `${unique('dup-user')}@example.com`;
    await request(app.getHttpServer())
      .post('/users')
      .send({
        employeeNumber,
        email,
        firstName: 'Casey',
        lastName: 'Lee',
      })
      .expect(201);
    await request(app.getHttpServer())
      .post('/users')
      .send({
        employeeNumber: unique('another-emp'),
        email,
        firstName: 'Jordan',
        lastName: 'Smith',
      })
      .expect(409);
  });
});
