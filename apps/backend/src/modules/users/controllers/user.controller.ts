import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { IdentityAggregateType } from '@prisma/client';
import type { AuthenticatedRequest } from '../../auth/interfaces/authenticated-request.interface';
import { CreatePermissionDto } from '../dto/create-permission.dto';
import { CreateRoleDto } from '../dto/create-role.dto';
import { CreateUserDto } from '../dto/create-user.dto';
import { AssignTerminalDto } from '../dto/assign-terminal.dto';
import { UpdateUserDto } from '../dto/update-user.dto';
import {
  AssignPermissionDto,
  AssignRoleDto,
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
    @Req() request: AuthenticatedRequest,
  ) {
    return this.userService.createUser(
      dto,
      request.correlationId ?? request.requestId,
      request.user.userId,
    );
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

  @Patch('users/:id')
  @Permissions(PERMISSIONS.USER_MANAGE)
  updateUser(
    @Param('id') id: string,
    @Body() dto: UpdateUserDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.userService.updateUser(
      id,
      dto,
      request.user.userId,
      request.correlationId ?? request.requestId,
    );
  }

  @Post('users/:id/activate')
  @Permissions(PERMISSIONS.USER_MANAGE)
  activateUser(
    @Param('id') id: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.userService.activateUser(
      id,
      request.user.userId,
      request.correlationId ?? request.requestId,
    );
  }

  @Post('users/:id/deactivate')
  @Permissions(PERMISSIONS.USER_MANAGE)
  deactivateUser(
    @Param('id') id: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.userService.deactivateUser(
      id,
      request.user.userId,
      request.correlationId ?? request.requestId,
    );
  }

  @Post('users/:id/assign-terminal')
  @Permissions(PERMISSIONS.USER_MANAGE)
  assignTerminal(
    @Param('id') id: string,
    @Body() dto: AssignTerminalDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.userService.assignTerminal(
      id,
      dto.terminalId,
      request.user.userId,
      request.correlationId ?? request.requestId,
    );
  }

  @Post('users/:id/roles')
  @Permissions(PERMISSIONS.USER_MANAGE)
  assignRole(
    @Param('id') id: string,
    @Body() dto: AssignRoleDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.userService.assignRole(
      id,
      dto.roleId,
      request.user.userId,
      request.correlationId ?? request.requestId,
    );
  }

  @Delete('users/:id/roles/:roleId')
  @Permissions(PERMISSIONS.USER_MANAGE)
  removeRole(
    @Param('id') id: string,
    @Param('roleId') roleId: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.userService.removeRole(
      id,
      roleId,
      request.user.userId,
      request.correlationId ?? request.requestId,
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
    @Req() request: AuthenticatedRequest,
  ) {
    return this.userService.createRole(
      dto,
      request.correlationId ?? request.requestId,
      request.user.userId,
    );
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
    @Req() request: AuthenticatedRequest,
  ) {
    return this.userService.assignPermission(
      id,
      dto.permissionId,
      request.user.userId,
      request.correlationId ?? request.requestId,
    );
  }

  @Post('permissions')
  @Permissions(PERMISSIONS.ROLE_MANAGE)
  createPermission(
    @Body() dto: CreatePermissionDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.userService.createPermission(
      dto,
      request.correlationId ?? request.requestId,
      request.user.userId,
    );
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
