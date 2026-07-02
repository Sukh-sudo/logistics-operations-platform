import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaClient } from '@prisma/client';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaExceptionFilter } from '../src/common/filters/prisma-exception.filter';
import { createAuthenticatedAdmin } from './authenticated-admin.fixture';

const prisma = new PrismaClient();

describe('Users (e2e)', () => {
  let app: INestApplication;
  let sequence = 0;
  let authorization: string;

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
    authorization = await createAuthenticatedAdmin(app, prisma, 'users-admin');
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  it('manages the user lifecycle, roles, permissions, events, and snapshot', async () => {
    const suffix = unique('identity');
    const permission = await request(app.getHttpServer())
      .post('/permissions')
      .set('Authorization', authorization)
      .send({
        code: `packages.receive.${suffix}`,
        description: 'Receive packages',
      })
      .expect(201);
    const role = await request(app.getHttpServer())
      .post('/roles')
      .set('Authorization', authorization)
      .send({
        name: `operator ${suffix}`,
        description: 'Terminal operator',
      })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/roles/${role.body.role.id}/permissions`)
      .set('Authorization', authorization)
      .send({ permissionId: permission.body.permission.id })
      .expect(201);

    const created = await request(app.getHttpServer())
      .post('/users')
      .set('Authorization', authorization)
      .send({
        employeeNumber: unique('emp'),
        email: `${unique('operator')}@example.com`,
        firstName: 'Taylor',
        lastName: 'Morgan',
        password: 'StrongPassword!1',
      })
      .expect(201);
    const userId = created.body.user.id;

    expect(created.body.snapshot.currentStatus).toBe('INACTIVE');
    expect(created.body.events[0].eventType).toBe('USER_CREATED');

    const terminal = await request(app.getHttpServer())
      .post('/terminals')
      .send({ terminalCode: unique('UT'), name: 'User terminal', city: 'Calgary', province: 'Alberta', country: 'Canada', timezone: 'America/Edmonton' })
      .expect(201);
    const terminalAssignment = await request(app.getHttpServer())
      .post(`/users/${userId}/assign-terminal`)
      .set('Authorization', authorization)
      .send({ terminalId: terminal.body.terminal.id })
      .expect(201);
    expect(terminalAssignment.body.snapshot.currentTerminalId).toBe(terminal.body.terminal.id);
    expect(terminalAssignment.body.event.eventType).toBe('TERMINAL_ASSIGNED');

    await request(app.getHttpServer())
      .post(`/users/${userId}/activate`)
      .set('Authorization', authorization)
      .send({})
      .expect(201);

    const assigned = await request(app.getHttpServer())
      .post(`/users/${userId}/roles`)
      .set('Authorization', authorization)
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
      .set('Authorization', authorization)
      .expect(200);
    expect(snapshot.body).toMatchObject({
      userId,
      currentStatus: 'ACTIVE',
      roleNames: [role.body.role.name],
      permissions: [permission.body.permission.code],
    });

    const history = await request(app.getHttpServer())
      .get(`/users/${userId}/history`)
      .set('Authorization', authorization)
      .expect(200);
    expect(history.body.map((event: { eventType: string }) => event.eventType))
      .toEqual(['USER_CREATED', 'TERMINAL_ASSIGNED', 'USER_ACTIVATED', 'ROLE_ASSIGNED']);

    await request(app.getHttpServer())
      .delete(`/users/${userId}/roles/${role.body.role.id}`)
      .set('Authorization', authorization)
      .send({})
      .expect(200);
    await request(app.getHttpServer())
      .post(`/users/${userId}/deactivate`)
      .set('Authorization', authorization)
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
      .set('Authorization', authorization)
      .send({ email: 'not-an-email' })
      .expect(400);

    const employeeNumber = unique('dup-emp');
    const email = `${unique('dup-user')}@example.com`;
    await request(app.getHttpServer())
      .post('/users')
      .set('Authorization', authorization)
      .send({
        employeeNumber,
        email,
        firstName: 'Casey',
        lastName: 'Lee',
        password: 'StrongPassword!1',
      })
      .expect(201);
    await request(app.getHttpServer())
      .post('/users')
      .set('Authorization', authorization)
      .send({
        employeeNumber: unique('another-emp'),
        email,
        firstName: 'Jordan',
        lastName: 'Smith',
        password: 'StrongPassword!1',
      })
      .expect(409);
  });
});
