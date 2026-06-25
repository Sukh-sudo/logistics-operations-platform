import {
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import {
  IdentityEventType,
  UserEventType,
  UserStatus,
} from '@prisma/client';
import { UserService } from '../services/user.service';

describe('UserService', () => {
  const tx = {
    user: {
      findFirst: jest.fn(),
      create: jest.fn(),
    },
    userEvent: {
      create: jest.fn(),
    },
    userSnapshot: {
      create: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    role: {
      findUnique: jest.fn(),
      create: jest.fn(),
    },
    permission: {
      findUnique: jest.fn(),
      create: jest.fn(),
    },
    userRole: {
      findUnique: jest.fn(),
      create: jest.fn(),
      delete: jest.fn(),
      findMany: jest.fn(),
    },
    rolePermission: {
      findUnique: jest.fn(),
      create: jest.fn(),
    },
    identityEvent: {
      create: jest.fn(),
    },
  };
  const prisma = {
    $transaction: jest.fn((callback) => callback(tx)),
  };

  let service: UserService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new UserService(prisma as never);
  });

  it('creates an inactive user event and snapshot atomically', async () => {
    const createdAt = new Date();
    tx.user.findFirst.mockResolvedValue(null);
    tx.user.create.mockResolvedValue({
      id: 'user-1',
      employeeNumber: 'EMP-1',
      email: 'operator@example.com',
      firstName: 'Taylor',
      lastName: 'Morgan',
    });
    tx.userEvent.create.mockResolvedValue({
      id: 'event-1',
      eventType: UserEventType.USER_CREATED,
      createdAt,
    });
    tx.userSnapshot.create.mockResolvedValue({
      userId: 'user-1',
      currentStatus: UserStatus.INACTIVE,
    });

    const result = await service.createUser({
      employeeNumber: ' emp-1 ',
      email: ' Operator@Example.com ',
      firstName: ' Taylor ',
      lastName: ' Morgan ',
    });

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(tx.user.create).toHaveBeenCalledWith({
      data: {
        employeeNumber: 'EMP-1',
        email: 'operator@example.com',
        firstName: 'Taylor',
        lastName: 'Morgan',
      },
    });
    expect(tx.userEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        eventType: UserEventType.USER_CREATED,
      }),
    });
    expect(tx.userSnapshot.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        currentStatus: UserStatus.INACTIVE,
        lastActivityAt: createdAt,
      }),
    });
    expect(result.events).toHaveLength(1);
  });

  it('rejects duplicate user identity values', async () => {
    tx.user.findFirst.mockResolvedValue({
      email: 'operator@example.com',
    });

    await expect(
      service.createUser({
        employeeNumber: 'EMP-1',
        email: 'operator@example.com',
        firstName: 'Taylor',
        lastName: 'Morgan',
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('activates a user and updates the snapshot in one transaction', async () => {
    const createdAt = new Date();
    tx.userSnapshot.findUnique.mockResolvedValue({
      userId: 'user-1',
      currentStatus: UserStatus.INACTIVE,
    });
    tx.userEvent.create.mockResolvedValue({
      id: 'event-2',
      eventType: UserEventType.USER_ACTIVATED,
      createdAt,
    });
    tx.userSnapshot.update.mockResolvedValue({
      userId: 'user-1',
      currentStatus: UserStatus.ACTIVE,
    });

    const result = await service.activateUser('user-1');

    expect(tx.userEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        eventType: UserEventType.USER_ACTIVATED,
      }),
    });
    expect(tx.userSnapshot.update).toHaveBeenCalledWith({
      where: { userId: 'user-1' },
      data: {
        currentStatus: UserStatus.ACTIVE,
        lastActivityAt: createdAt,
      },
    });
    expect(result.snapshot.currentStatus).toBe(UserStatus.ACTIVE);
  });

  it('rejects an invalid repeated lifecycle transition', async () => {
    tx.userSnapshot.findUnique.mockResolvedValue({
      userId: 'user-1',
      currentStatus: UserStatus.ACTIVE,
    });

    await expect(service.activateUser('user-1')).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(tx.userEvent.create).not.toHaveBeenCalled();
  });

  it('assigns a role and derives additive permissions into the snapshot', async () => {
    const createdAt = new Date();
    tx.userSnapshot.findUnique.mockResolvedValue({
      userId: 'user-1',
      currentStatus: UserStatus.ACTIVE,
    });
    tx.role.findUnique.mockResolvedValue({
      id: 'role-1',
      name: 'OPERATOR',
    });
    tx.userRole.findUnique.mockResolvedValue(null);
    tx.userRole.create.mockResolvedValue({});
    tx.userEvent.create.mockResolvedValue({
      id: 'event-3',
      eventType: UserEventType.ROLE_ASSIGNED,
      createdAt,
    });
    tx.userRole.findMany.mockResolvedValue([
      {
        role: {
          name: 'OPERATOR',
          permissions: [
            { permission: { code: 'packages.receive' } },
            { permission: { code: 'packages.view' } },
          ],
        },
      },
    ]);
    tx.userSnapshot.update.mockResolvedValue({
      userId: 'user-1',
      roleNames: ['OPERATOR'],
      permissions: ['packages.receive', 'packages.view'],
    });

    const result = await service.assignRole('user-1', 'role-1');

    expect(tx.userRole.create).toHaveBeenCalledWith({
      data: { userId: 'user-1', roleId: 'role-1' },
    });
    expect(tx.userSnapshot.update).toHaveBeenCalledWith({
      where: { userId: 'user-1' },
      data: {
        roleNames: ['OPERATOR'],
        permissions: ['packages.receive', 'packages.view'],
        lastActivityAt: createdAt,
      },
    });
    expect(result.event.eventType).toBe(UserEventType.ROLE_ASSIGNED);
  });

  it('creates a business event when a permission is assigned to a role', async () => {
    const createdAt = new Date();
    tx.role.findUnique.mockResolvedValue({
      id: 'role-1',
      name: 'OPERATOR',
    });
    tx.permission.findUnique.mockResolvedValue({
      id: 'permission-1',
      code: 'packages.receive',
    });
    tx.rolePermission.findUnique.mockResolvedValue(null);
    tx.rolePermission.create.mockResolvedValue({});
    tx.identityEvent.create.mockResolvedValue({
      id: 'identity-event-1',
      eventType: IdentityEventType.PERMISSION_ASSIGNED,
      createdAt,
    });
    tx.userRole.findMany.mockResolvedValue([]);

    const result = await service.assignPermission(
      'role-1',
      'permission-1',
    );

    expect(tx.rolePermission.create).toHaveBeenCalledWith({
      data: { roleId: 'role-1', permissionId: 'permission-1' },
    });
    expect(tx.identityEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        eventType: IdentityEventType.PERMISSION_ASSIGNED,
      }),
    });
    expect(result.updatedUserCount).toBe(0);
  });
});
