import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  IdentityAggregateType,
  IdentityEventType,
  Prisma,
  UserEventType,
  UserStatus,
} from '@prisma/client';
import { randomUUID } from 'crypto';
import { PrismaService } from '../../../infrastructure/prisma/prisma.service';
import { CredentialService } from '../../auth/services/credential.service';
import { CreatePermissionDto } from '../dto/create-permission.dto';
import { CreateRoleDto } from '../dto/create-role.dto';
import { CreateUserDto } from '../dto/create-user.dto';

type TransactionClient = Prisma.TransactionClient;

@Injectable()
export class UserService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly credentials: CredentialService,
  ) {}

  async createUser(dto: CreateUserDto, requestId?: string) {
    const correlationId = requestId ?? randomUUID();
    const employeeNumber = this.normalizeEmployeeNumber(dto.employeeNumber);
    const email = this.normalizeEmail(dto.email);
    const passwordHash = await this.credentials.hashPassword(dto.password);

    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.user.findFirst({
        where: {
          OR: [{ employeeNumber }, { email }],
        },
      });

      if (existing) {
        throw new ConflictException(
          existing.email === email
            ? 'User email already exists'
            : 'Employee number already exists',
        );
      }

      const user = await tx.user.create({
        data: {
          employeeNumber,
          email,
          firstName: dto.firstName.trim(),
          lastName: dto.lastName.trim(),
          passwordHash,
        },
      });

      const createdEvent = await tx.userEvent.create({
        data: {
          userId: user.id,
          eventType: UserEventType.USER_CREATED,
          actorUserId: dto.actorUserId,
          correlationId,
          payload: {
            employeeNumber,
            email,
            firstName: user.firstName,
            lastName: user.lastName,
          },
        },
      });

      let lastEvent = createdEvent;
      if (dto.status === UserStatus.ACTIVE) {
        lastEvent = await tx.userEvent.create({
          data: {
            userId: user.id,
            eventType: UserEventType.USER_ACTIVATED,
            actorUserId: dto.actorUserId,
            correlationId,
          },
        });
      }

      const snapshot = await tx.userSnapshot.create({
        data: {
          userId: user.id,
          employeeNumber,
          email,
          firstName: user.firstName,
          lastName: user.lastName,
          currentStatus: dto.status ?? UserStatus.INACTIVE,
          lastActivityAt: lastEvent.createdAt,
        },
      });

      return {
        user,
        snapshot,
        events:
          lastEvent.id === createdEvent.id
            ? [createdEvent]
            : [createdEvent, lastEvent],
      };
    });
  }

  getUsers() {
    return this.prisma.userSnapshot.findMany({
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
    });
  }

  async getUser(userId: string) {
    const snapshot = await this.prisma.userSnapshot.findUnique({
      where: { userId },
    });

    if (!snapshot) {
      throw new NotFoundException('User not found');
    }

    return snapshot;
  }

  async getUserHistory(userId: string) {
    await this.getUser(userId);

    return this.prisma.userEvent.findMany({
      where: { userId },
      orderBy: { createdAt: 'asc' },
    });
  }

  activateUser(
    userId: string,
    actorUserId?: string,
    requestId?: string,
  ) {
    return this.changeUserStatus(
      userId,
      UserStatus.ACTIVE,
      UserEventType.USER_ACTIVATED,
      actorUserId,
      requestId,
    );
  }

  deactivateUser(
    userId: string,
    actorUserId?: string,
    requestId?: string,
  ) {
    return this.changeUserStatus(
      userId,
      UserStatus.INACTIVE,
      UserEventType.USER_DEACTIVATED,
      actorUserId,
      requestId,
    );
  }

  async assignRole(
    userId: string,
    roleId: string,
    actorUserId?: string,
    requestId?: string,
  ) {
    const correlationId = requestId ?? randomUUID();

    return this.prisma.$transaction(async (tx) => {
      await this.requireUserSnapshot(tx, userId);
      const role = await tx.role.findUnique({ where: { id: roleId } });

      if (!role) {
        throw new NotFoundException('Role not found');
      }

      const existing = await tx.userRole.findUnique({
        where: { userId_roleId: { userId, roleId } },
      });

      if (existing) {
        throw new ConflictException('Role is already assigned to this user');
      }

      await tx.userRole.create({
        data: { userId, roleId },
      });

      const event = await tx.userEvent.create({
        data: {
          userId,
          eventType: UserEventType.ROLE_ASSIGNED,
          actorUserId,
          correlationId,
          payload: { roleId, roleName: role.name },
        },
      });

      const snapshot = await this.rebuildAccessSnapshot(
        tx,
        userId,
        event.createdAt,
      );

      return { snapshot, event };
    });
  }

  async removeRole(
    userId: string,
    roleId: string,
    actorUserId?: string,
    requestId?: string,
  ) {
    const correlationId = requestId ?? randomUUID();

    return this.prisma.$transaction(async (tx) => {
      await this.requireUserSnapshot(tx, userId);
      const assignment = await tx.userRole.findUnique({
        where: { userId_roleId: { userId, roleId } },
        include: { role: true },
      });

      if (!assignment) {
        throw new NotFoundException('Role assignment not found');
      }

      await tx.userRole.delete({
        where: { userId_roleId: { userId, roleId } },
      });

      const event = await tx.userEvent.create({
        data: {
          userId,
          eventType: UserEventType.ROLE_REMOVED,
          actorUserId,
          correlationId,
          payload: { roleId, roleName: assignment.role.name },
        },
      });

      const snapshot = await this.rebuildAccessSnapshot(
        tx,
        userId,
        event.createdAt,
      );

      return { snapshot, event };
    });
  }

  async createRole(dto: CreateRoleDto, requestId?: string) {
    const correlationId = requestId ?? randomUUID();
    const name = this.normalizeRoleName(dto.name);

    return this.prisma.$transaction(async (tx) => {
      if (await tx.role.findUnique({ where: { name } })) {
        throw new ConflictException('Role name already exists');
      }

      const role = await tx.role.create({
        data: {
          name,
          description: dto.description?.trim(),
        },
      });
      const event = await tx.identityEvent.create({
        data: {
          aggregateId: role.id,
          aggregateType: IdentityAggregateType.ROLE,
          eventType: IdentityEventType.ROLE_CREATED,
          actorUserId: dto.actorUserId,
          correlationId,
          payload: { name: role.name, description: role.description },
        },
      });

      return { role, event };
    });
  }

  getRoles() {
    return this.prisma.role.findMany({
      include: {
        permissions: {
          include: { permission: true },
          orderBy: { permission: { code: 'asc' } },
        },
      },
      orderBy: { name: 'asc' },
    });
  }

  async createPermission(dto: CreatePermissionDto, requestId?: string) {
    const correlationId = requestId ?? randomUUID();
    const code = this.normalizePermissionCode(dto.code);

    return this.prisma.$transaction(async (tx) => {
      if (await tx.permission.findUnique({ where: { code } })) {
        throw new ConflictException('Permission code already exists');
      }

      const permission = await tx.permission.create({
        data: {
          code,
          description: dto.description?.trim(),
        },
      });
      const event = await tx.identityEvent.create({
        data: {
          aggregateId: permission.id,
          aggregateType: IdentityAggregateType.PERMISSION,
          eventType: IdentityEventType.PERMISSION_CREATED,
          actorUserId: dto.actorUserId,
          correlationId,
          payload: {
            code: permission.code,
            description: permission.description,
          },
        },
      });

      return { permission, event };
    });
  }

  getPermissions() {
    return this.prisma.permission.findMany({
      orderBy: { code: 'asc' },
    });
  }

  async assignPermission(
    roleId: string,
    permissionId: string,
    actorUserId?: string,
    requestId?: string,
  ) {
    const correlationId = requestId ?? randomUUID();

    return this.prisma.$transaction(async (tx) => {
      const [role, permission] = await Promise.all([
        tx.role.findUnique({ where: { id: roleId } }),
        tx.permission.findUnique({ where: { id: permissionId } }),
      ]);

      if (!role) {
        throw new NotFoundException('Role not found');
      }
      if (!permission) {
        throw new NotFoundException('Permission not found');
      }

      const existing = await tx.rolePermission.findUnique({
        where: { roleId_permissionId: { roleId, permissionId } },
      });
      if (existing) {
        throw new ConflictException(
          'Permission is already assigned to this role',
        );
      }

      await tx.rolePermission.create({
        data: { roleId, permissionId },
      });
      const event = await tx.identityEvent.create({
        data: {
          aggregateId: roleId,
          aggregateType: IdentityAggregateType.ROLE,
          eventType: IdentityEventType.PERMISSION_ASSIGNED,
          actorUserId,
          correlationId,
          payload: {
            roleId,
            roleName: role.name,
            permissionId,
            permissionCode: permission.code,
          },
        },
      });

      const assignments = await tx.userRole.findMany({
        where: { roleId },
        select: { userId: true },
      });
      let updatedUserCount = 0;
      for (const assignment of assignments) {
        await this.rebuildAccessSnapshot(
          tx,
          assignment.userId,
          event.createdAt,
        );
        updatedUserCount += 1;
      }

      return { role, permission, event, updatedUserCount };
    });
  }

  getIdentityHistory(
    aggregateType: IdentityAggregateType,
    aggregateId: string,
  ) {
    return this.prisma.identityEvent.findMany({
      where: { aggregateType, aggregateId },
      orderBy: { createdAt: 'asc' },
    });
  }

  private async changeUserStatus(
    userId: string,
    status: UserStatus,
    eventType: UserEventType,
    actorUserId?: string,
    requestId?: string,
  ) {
    const correlationId = requestId ?? randomUUID();

    return this.prisma.$transaction(async (tx) => {
      const current = await this.requireUserSnapshot(tx, userId);

      if (current.currentStatus === status) {
        throw new BadRequestException(
          status === UserStatus.ACTIVE
            ? 'User is already active'
            : 'User is already inactive',
        );
      }

      const event = await tx.userEvent.create({
        data: {
          userId,
          eventType,
          actorUserId,
          correlationId,
        },
      });
      const snapshot = await tx.userSnapshot.update({
        where: { userId },
        data: {
          currentStatus: status,
          lastActivityAt: event.createdAt,
        },
      });

      return { snapshot, event };
    });
  }

  private async requireUserSnapshot(
    tx: TransactionClient,
    userId: string,
  ) {
    const snapshot = await tx.userSnapshot.findUnique({
      where: { userId },
    });

    if (!snapshot) {
      throw new NotFoundException('User not found');
    }

    return snapshot;
  }

  private async rebuildAccessSnapshot(
    tx: TransactionClient,
    userId: string,
    lastActivityAt: Date,
  ) {
    const assignments = await tx.userRole.findMany({
      where: { userId },
      include: {
        role: {
          include: {
            permissions: {
              include: { permission: true },
            },
          },
        },
      },
    });
    const roleNames = assignments
      .map(({ role }) => role.name)
      .sort((left, right) => left.localeCompare(right));
    const permissions = [
      ...new Set(
        assignments.flatMap(({ role }) =>
          role.permissions.map(({ permission }) => permission.code),
        ),
      ),
    ].sort((left, right) => left.localeCompare(right));

    return tx.userSnapshot.update({
      where: { userId },
      data: { roleNames, permissions, lastActivityAt },
    });
  }

  private normalizeEmployeeNumber(value: string) {
    return value.trim().toUpperCase();
  }

  private normalizeEmail(value: string) {
    return value.trim().toLowerCase();
  }

  private normalizeRoleName(value: string) {
    return value.trim().toUpperCase().replace(/\s+/g, '_');
  }

  private normalizePermissionCode(value: string) {
    return value.trim().toLowerCase();
  }
}
