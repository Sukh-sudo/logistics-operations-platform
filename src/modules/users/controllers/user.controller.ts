import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { IdentityAggregateType } from '@prisma/client';
import type { RequestWithId } from '../../../common/middleware/request-id.middleware';
import { CreatePermissionDto } from '../dto/create-permission.dto';
import { CreateRoleDto } from '../dto/create-role.dto';
import { CreateUserDto } from '../dto/create-user.dto';
import {
  AssignPermissionDto,
  AssignRoleDto,
  UserActionDto,
} from '../dto/identity-assignment.dto';
import { UserService } from '../services/user.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { PERMISSIONS } from '../../authorization/constants/permissions';
import { Permissions } from '../../authorization/decorators/permissions.decorator';
import { PermissionsGuard } from '../../authorization/guards/permissions.guard';

@Controller()
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Post('users')
  @Permissions(PERMISSIONS.USER_MANAGE)
  createUser(
    @Body() dto: CreateUserDto,
    @Req() request: RequestWithId,
  ) {
    return this.userService.createUser(dto, request.requestId);
  }

  @Get('users')
  @Permissions(PERMISSIONS.USER_MANAGE)
  getUsers() {
    return this.userService.getUsers();
  }

  @Get('users/:id/history')
  @Permissions(PERMISSIONS.USER_MANAGE)
  getUserHistory(@Param('id') id: string) {
    return this.userService.getUserHistory(id);
  }

  @Post('users/:id/activate')
  @Permissions(PERMISSIONS.USER_MANAGE)
  activateUser(
    @Param('id') id: string,
    @Body() dto: UserActionDto,
    @Req() request: RequestWithId,
  ) {
    return this.userService.activateUser(
      id,
      dto.actorUserId,
      request.requestId,
    );
  }

  @Post('users/:id/deactivate')
  @Permissions(PERMISSIONS.USER_MANAGE)
  deactivateUser(
    @Param('id') id: string,
    @Body() dto: UserActionDto,
    @Req() request: RequestWithId,
  ) {
    return this.userService.deactivateUser(
      id,
      dto.actorUserId,
      request.requestId,
    );
  }

  @Post('users/:id/roles')
  @Permissions(PERMISSIONS.USER_MANAGE)
  assignRole(
    @Param('id') id: string,
    @Body() dto: AssignRoleDto,
    @Req() request: RequestWithId,
  ) {
    return this.userService.assignRole(
      id,
      dto.roleId,
      dto.actorUserId,
      request.requestId,
    );
  }

  @Delete('users/:id/roles/:roleId')
  @Permissions(PERMISSIONS.USER_MANAGE)
  removeRole(
    @Param('id') id: string,
    @Param('roleId') roleId: string,
    @Body() dto: UserActionDto,
    @Req() request: RequestWithId,
  ) {
    return this.userService.removeRole(
      id,
      roleId,
      dto.actorUserId,
      request.requestId,
    );
  }

  @Get('users/:id')
  @Permissions(PERMISSIONS.USER_MANAGE)
  getUser(@Param('id') id: string) {
    return this.userService.getUser(id);
  }

  @Post('roles')
  @Permissions(PERMISSIONS.ROLE_MANAGE)
  createRole(
    @Body() dto: CreateRoleDto,
    @Req() request: RequestWithId,
  ) {
    return this.userService.createRole(dto, request.requestId);
  }

  @Get('roles')
  @Permissions(PERMISSIONS.ROLE_MANAGE)
  getRoles() {
    return this.userService.getRoles();
  }

  @Get('roles/:id/history')
  @Permissions(PERMISSIONS.ROLE_MANAGE)
  getRoleHistory(@Param('id') id: string) {
    return this.userService.getIdentityHistory(
      IdentityAggregateType.ROLE,
      id,
    );
  }

  @Post('roles/:id/permissions')
  @Permissions(PERMISSIONS.ROLE_MANAGE)
  assignPermission(
    @Param('id') id: string,
    @Body() dto: AssignPermissionDto,
    @Req() request: RequestWithId,
  ) {
    return this.userService.assignPermission(
      id,
      dto.permissionId,
      dto.actorUserId,
      request.requestId,
    );
  }

  @Post('permissions')
  @Permissions(PERMISSIONS.ROLE_MANAGE)
  createPermission(
    @Body() dto: CreatePermissionDto,
    @Req() request: RequestWithId,
  ) {
    return this.userService.createPermission(dto, request.requestId);
  }

  @Get('permissions')
  @Permissions(PERMISSIONS.ROLE_MANAGE)
  getPermissions() {
    return this.userService.getPermissions();
  }

  @Get('permissions/:id/history')
  @Permissions(PERMISSIONS.ROLE_MANAGE)
  getPermissionHistory(@Param('id') id: string) {
    return this.userService.getIdentityHistory(
      IdentityAggregateType.PERMISSION,
      id,
    );
  }
}
