import type { INestApplication } from '@nestjs/common';
import { PrismaClient, UserStatus } from '@prisma/client';
import request from 'supertest';
import { UserService } from '../src/modules/users/services/user.service';

export async function createAuthenticatedAdmin(
  app: INestApplication,
  prisma: PrismaClient,
  prefix: string,
) {
  const users = app.get(UserService);
  const suffix = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
  const permissionIds: string[] = [];

  for (const code of ['user.manage', 'role.manage']) {
    const existing = await prisma.permission.findUnique({ where: { code } });
    const permission =
      existing ??
      (await users.createPermission({ code })).permission;
    permissionIds.push(permission.id);
  }

  const { role } = await users.createRole({ name: `${prefix}-${suffix}` });
  for (const permissionId of permissionIds) {
    await users.assignPermission(role.id, permissionId);
  }

  const email = `${prefix}-${suffix}@example.com`;
  const password = 'IntegrationAdmin!1';
  const { user } = await users.createUser({
    employeeNumber: `${prefix}-${suffix}`,
    email,
    firstName: 'Integration',
    lastName: 'Administrator',
    password,
    status: UserStatus.ACTIVE,
  });
  await users.assignRole(user.id, role.id);

  const login = await request(app.getHttpServer())
    .post('/auth/login')
    .send({ email, password })
    .expect(201);

  return `Bearer ${login.body.accessToken}`;
}
