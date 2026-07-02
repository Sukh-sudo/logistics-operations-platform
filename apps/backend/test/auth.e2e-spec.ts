import {
  Controller,
  Get,
  INestApplication,
  UseGuards,
  ValidationPipe,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaClient } from '@prisma/client';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaExceptionFilter } from '../src/common/filters/prisma-exception.filter';
import { JwtAuthGuard } from '../src/modules/auth/guards/jwt-auth.guard';
import { AuthorizationModule } from '../src/modules/authorization/authorization.module';
import { Permissions } from '../src/modules/authorization/decorators/permissions.decorator';
import { PermissionsGuard } from '../src/modules/authorization/guards/permissions.guard';
import { createAuthenticatedAdmin } from './authenticated-admin.fixture';

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
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
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
      .post('/auth/refresh')
      .send({ refreshToken: login.body.refreshToken })
      .expect(401);

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
});
