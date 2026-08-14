import {
  Controller,
  Get,
  INestApplication,
  UseGuards,
  ValidationPipe,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { HandheldDevicePlatform, PrismaClient, UserStatus } from '@prisma/client';
import { randomUUID } from 'crypto';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaExceptionFilter } from '../src/common/filters/prisma-exception.filter';
import { JwtAuthGuard } from '../src/modules/auth/guards/jwt-auth.guard';
import { AuthorizationModule } from '../src/modules/authorization/authorization.module';
import { Permissions } from '../src/modules/authorization/decorators/permissions.decorator';
import { PermissionsGuard } from '../src/modules/authorization/guards/permissions.guard';
import { createAuthenticatedAdmin } from './authenticated-admin.fixture';
import { UserService } from '../src/modules/users/services/user.service';
import { TerminalService } from '../src/modules/terminals/services/terminal.service';

@Controller('authorization-test')
class AuthorizationTestController {
  @Get()
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions('package.view')
  protectedResource() {
    return { authorized: true };
  }
}

const prisma = new PrismaClient();

describe('Authentication and authorization (e2e)', () => {
  let app: INestApplication;
  let sequence = 0;
  let administratorAuthorization: string;
  let administratorUserId: string;
  const unique = (prefix: string) =>
    `${prefix}-${Date.now().toString(36)}-${sequence++}`;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule, AuthorizationModule],
      controllers: [AuthorizationTestController],
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
    administratorAuthorization = await createAuthenticatedAdmin(
      app,
      prisma,
      'auth-admin',
    );
    const administratorToken = administratorAuthorization.replace('Bearer ', '');
    administratorUserId = JSON.parse(
      Buffer.from(administratorToken.split('.')[1], 'base64url').toString('utf8'),
    ).sub as string;
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  it('protects operational APIs while preserving explicit public endpoints', async () => {
    await request(app.getHttpServer()).get('/terminals').expect(401);
    await request(app.getHttpServer()).get('/health').expect(200);
  });

  it('rotates sessions, enforces snapshot permissions, and revokes credentials', async () => {
    const permission = await request(app.getHttpServer())
      .post('/permissions')
      .set('Authorization', administratorAuthorization)
      .send({ code: `package.view.${unique('auth')}` })
      .expect(201);
    const requiredPermission = permission.body.permission.code;
    const role = await request(app.getHttpServer())
      .post('/roles')
      .set('Authorization', administratorAuthorization)
      .send({ name: unique('dispatcher') })
      .expect(201);
    await request(app.getHttpServer())
      .post(`/roles/${role.body.role.id}/permissions`)
      .set('Authorization', administratorAuthorization)
      .send({ permissionId: permission.body.permission.id })
      .expect(201);

    // The test route uses the canonical permission, so add it to this role too.
    const canonicalPermission = await request(app.getHttpServer())
      .post('/permissions')
      .set('Authorization', administratorAuthorization)
      .send({ code: 'package.view' });
    const permissionId =
      canonicalPermission.status === 201
        ? canonicalPermission.body.permission.id
        : (await prisma.permission.findUniqueOrThrow({
            where: { code: 'package.view' },
          })).id;
    await request(app.getHttpServer())
      .post(`/roles/${role.body.role.id}/permissions`)
      .set('Authorization', administratorAuthorization)
      .send({ permissionId })
      .expect(201);

    const email = `${unique('auth-user')}@example.com`;
    const password = 'StrongPassword!1';
    const created = await request(app.getHttpServer())
      .post('/users')
      .set('Authorization', administratorAuthorization)
      .send({
        employeeNumber: unique('auth-emp'),
        email,
        firstName: 'Alex',
        lastName: 'Rivera',
        password,
        status: 'ACTIVE',
      })
      .expect(201);
    const userId = created.body.user.id;
    expect(
      await prisma.userEvent.findFirstOrThrow({
        where: { userId, eventType: 'USER_CREATED' },
      }),
    ).toMatchObject({ actorUserId: administratorUserId });
    await request(app.getHttpServer())
      .post(`/users/${userId}/roles`)
      .set('Authorization', administratorAuthorization)
      .send({ roleId: role.body.role.id, actorUserId: userId })
      .expect(400);
    await request(app.getHttpServer())
      .post(`/users/${userId}/roles`)
      .set('Authorization', administratorAuthorization)
      .send({ roleId: role.body.role.id })
      .expect(201);

    const login = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email, password })
      .expect(201);
    expect(login.body).toMatchObject({ tokenType: 'Bearer', expiresIn: 900 });
    expect(login.body.refreshToken).toHaveLength(64);

    await request(app.getHttpServer())
      .get('/auth/me')
      .set('Authorization', `Bearer ${login.body.accessToken}`)
      .expect(200)
      .expect(({ body }) => {
        expect(body.permissions).toEqual(
          expect.arrayContaining(['package.view', requiredPermission]),
        );
      });
    await request(app.getHttpServer())
      .get('/authorization-test')
      .set('Authorization', `Bearer ${login.body.accessToken}`)
      .expect(200, { authorized: true });

    // A valid account cannot cross into unrelated operational or recovery APIs.
    // Notification self-service is the explicit exception and is recipient-scoped.
    await request(app.getHttpServer())
      .get('/terminals')
      .set('Authorization', `Bearer ${login.body.accessToken}`)
      .expect(403);
    await request(app.getHttpServer())
      .get('/notifications')
      .set('Authorization', `Bearer ${login.body.accessToken}`)
      .expect(200, []);
    await request(app.getHttpServer())
      .post('/snapshots/rebuild')
      .set('Authorization', `Bearer ${login.body.accessToken}`)
      .expect(403);

    await request(app.getHttpServer())
      .delete(`/users/${userId}/roles/${role.body.role.id}`)
      .set('Authorization', administratorAuthorization)
      .send({})
      .expect(200);
    await request(app.getHttpServer())
      .get('/authorization-test')
      .set('Authorization', `Bearer ${login.body.accessToken}`)
      .expect(403);

    const refreshed = await request(app.getHttpServer())
      .post('/auth/refresh')
      .send({ refreshToken: login.body.refreshToken })
      .expect(201);

    await request(app.getHttpServer())
      .post('/auth/change-password')
      .set('Authorization', `Bearer ${refreshed.body.accessToken}`)
      .send({ currentPassword: password, newPassword: 'NewStrongPassword!2' })
      .expect(201);
    await request(app.getHttpServer())
      .get('/auth/me')
      .set('Authorization', `Bearer ${refreshed.body.accessToken}`)
      .expect(401);
    await request(app.getHttpServer())
      .post('/auth/refresh')
      .send({ refreshToken: refreshed.body.refreshToken })
      .expect(401);

    const secondLogin = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email, password: 'NewStrongPassword!2' })
      .expect(201);
    await request(app.getHttpServer())
      .post('/auth/logout')
      .set('Authorization', `Bearer ${secondLogin.body.accessToken}`)
      .send({ refreshToken: secondLogin.body.refreshToken })
      .expect(201, { loggedOut: true });

    const [snapshot, events] = await Promise.all([
      prisma.userSnapshot.findUniqueOrThrow({ where: { userId } }),
      prisma.userEvent.findMany({ where: { userId }, orderBy: { createdAt: 'asc' } }),
    ]);
    expect(snapshot.lastLoginAt).not.toBeNull();
    expect(events.map(({ eventType }) => eventType)).toEqual(
      expect.arrayContaining([
        'USER_AUTHENTICATED',
        'REFRESH_TOKEN_ROTATED',
        'PASSWORD_CHANGED',
        'USER_LOGGED_OUT',
      ]),
    );
  });

  it('keeps dashboard refresh tokens in an HttpOnly cookie', async () => {
    const users = app.get(UserService);
    const email = `${unique('web-cookie')}@example.com`;
    const password = 'WebCookiePassword!1';
    await users.createUser({
      employeeNumber: unique('web-cookie-emp'),
      email,
      firstName: 'Web',
      lastName: 'Cookie',
      password,
      status: UserStatus.ACTIVE,
    });

    const login = await request(app.getHttpServer())
      .post('/auth/web/login')
      .set('x-csrf-protection', '1')
      .send({ email, password })
      .expect(201);
    expect(login.body.refreshToken).toBeUndefined();
    const loginCookie = (login.headers['set-cookie'] as unknown as string[])[0];
    expect(loginCookie).toContain('refresh_token=');
    expect(loginCookie).toContain('HttpOnly');
    expect(loginCookie).toContain('SameSite=Strict');

    await request(app.getHttpServer())
      .post('/auth/web/refresh')
      .set('Cookie', loginCookie)
      .expect(403);
    const refreshed = await request(app.getHttpServer())
      .post('/auth/web/refresh')
      .set('Cookie', loginCookie)
      .set('x-csrf-protection', '1')
      .expect(201);
    expect(refreshed.body.refreshToken).toBeUndefined();
    expect(refreshed.headers['set-cookie']).toBeDefined();
  });

  it('detects rotated refresh-token replay and invalidates the successor session', async () => {
    const users = app.get(UserService);
    const email = `${unique('replay')}@example.com`;
    const password = 'ReplayDetection!1';
    const created = await users.createUser({
      employeeNumber: unique('replay-emp'),
      email,
      firstName: 'Replay',
      lastName: 'Detection',
      password,
      status: UserStatus.ACTIVE,
    });
    const login = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email, password })
      .expect(201);
    const successor = await request(app.getHttpServer())
      .post('/auth/refresh')
      .send({ refreshToken: login.body.refreshToken })
      .expect(201);

    await request(app.getHttpServer())
      .post('/auth/refresh')
      .send({ refreshToken: login.body.refreshToken })
      .expect(401);
    await request(app.getHttpServer())
      .post('/auth/refresh')
      .send({ refreshToken: successor.body.refreshToken })
      .expect(401);
    await request(app.getHttpServer())
      .get('/auth/me')
      .set('Authorization', `Bearer ${successor.body.accessToken}`)
      .expect(401);

    expect(
      await prisma.userEvent.count({
        where: {
          userId: created.user.id,
          eventType: 'REFRESH_TOKEN_REUSE_DETECTED',
        },
      }),
    ).toBe(1);
  });

  it('enrolls a handheld and invalidates its access and refresh sessions when revoked', async () => {
    const users = app.get(UserService);
    const terminals = app.get(TerminalService);
    const terminal = await terminals.createTerminal({
      terminalCode: threeLetterTerminalCode(),
      city: 'Calgary',
      province: 'Alberta',
      country: 'Canada',
      timezone: 'America/Edmonton',
    });
    const suffix = unique('managed-device');
    const badgeBarcode = `BADGE-${suffix}`;
    const employeeNumber = `EMP-${suffix}`;
    const employee = await users.createUser({
      employeeNumber,
      badgeBarcode,
      email: `${suffix}@example.com`,
      firstName: 'Managed',
      lastName: 'Operator',
      password: 'ManagedDevice!1',
      status: UserStatus.ACTIVE,
    });
    await users.assignTerminal(employee.user.id, terminal.terminal.id);
    const deviceId = randomUUID();

    const enrollment = await request(app.getHttpServer())
      .post('/handheld-devices')
      .set('Authorization', administratorAuthorization)
      .send({
        deviceId,
        displayName: 'Integration Android device',
        platform: HandheldDevicePlatform.ANDROID,
      })
      .expect(201);
    expect(enrollment.body.credential).toHaveLength(43);

    await request(app.getHttpServer())
      .post('/api/mobile/v1/auth/login')
      .send({
        badgeBarcode,
        employeeId: employeeNumber,
        deviceId,
        deviceCredential: 'x'.repeat(43),
      })
      .expect(401);

    const login = await request(app.getHttpServer())
      .post('/api/mobile/v1/auth/login')
      .send({
        badgeBarcode,
        employeeId: employeeNumber,
        deviceId,
        deviceCredential: enrollment.body.credential,
      })
      .expect(201);
    const refreshed = await request(app.getHttpServer())
      .post('/api/mobile/v1/auth/refresh')
      .send({ refreshToken: login.body.refreshToken })
      .expect(201);

    const stored = await prisma.handheldDevice.findUniqueOrThrow({
      where: { deviceId },
      include: { snapshot: true },
    });
    await request(app.getHttpServer())
      .post(`/handheld-devices/${stored.id}/revoke`)
      .set('Authorization', administratorAuthorization)
      .expect(201);

    await request(app.getHttpServer())
      .get('/api/mobile/v1/bootstrap')
      .set('Authorization', `Bearer ${refreshed.body.accessToken}`)
      .expect(401);
    await request(app.getHttpServer())
      .post('/api/mobile/v1/auth/refresh')
      .send({ refreshToken: refreshed.body.refreshToken })
      .expect(401);
    await request(app.getHttpServer())
      .post('/api/mobile/v1/auth/login')
      .send({
        badgeBarcode,
        employeeId: employeeNumber,
        deviceId,
        deviceCredential: enrollment.body.credential,
      })
      .expect(401);

    const [snapshot, events] = await Promise.all([
      prisma.handheldDeviceSnapshot.findUniqueOrThrow({ where: { id: stored.id } }),
      prisma.handheldDeviceEvent.findMany({
        where: { handheldDeviceId: stored.id },
        orderBy: { createdAt: 'asc' },
      }),
    ]);
    expect(snapshot.currentStatus).toBe('REVOKED');
    expect(events.map(({ eventType }) => eventType)).toEqual([
      'DEVICE_ENROLLED',
      'DEVICE_AUTHENTICATED',
      'DEVICE_TOKEN_REFRESHED',
      'DEVICE_REVOKED',
    ]);
  });
});

function threeLetterTerminalCode() {
  return Array.from({ length: 3 }, () =>
    String.fromCharCode(65 + Math.floor(Math.random() * 26)),
  ).join('');
}
