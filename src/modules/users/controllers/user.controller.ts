import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Req,
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

@Controller()
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Post('users')
  createUser(
    @Body() dto: CreateUserDto,
    @Req() request: RequestWithId,
  ) {
    return this.userService.createUser(dto, request.requestId);
  }

  @Get('users')
  getUsers() {
    return this.userService.getUsers();
  }

  @Get('users/:id/history')
  getUserHistory(@Param('id') id: string) {
    return this.userService.getUserHistory(id);
  }

  @Post('users/:id/activate')
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
  getUser(@Param('id') id: string) {
    return this.userService.getUser(id);
  }

  @Post('roles')
  createRole(
    @Body() dto: CreateRoleDto,
    @Req() request: RequestWithId,
  ) {
    return this.userService.createRole(dto, request.requestId);
  }

  @Get('roles')
  getRoles() {
    return this.userService.getRoles();
  }

  @Get('roles/:id/history')
  getRoleHistory(@Param('id') id: string) {
    return this.userService.getIdentityHistory(
      IdentityAggregateType.ROLE,
      id,
    );
  }

  @Post('roles/:id/permissions')
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
  createPermission(
    @Body() dto: CreatePermissionDto,
    @Req() request: RequestWithId,
  ) {
    return this.userService.createPermission(dto, request.requestId);
  }

  @Get('permissions')
  getPermissions() {
    return this.userService.getPermissions();
  }

  @Get('permissions/:id/history')
  getPermissionHistory(@Param('id') id: string) {
    return this.userService.getIdentityHistory(
      IdentityAggregateType.PERMISSION,
      id,
    );
  }
}
