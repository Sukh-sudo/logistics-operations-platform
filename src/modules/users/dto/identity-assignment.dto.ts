import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class AssignRoleDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  roleId: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  actorUserId?: string;
}

export class AssignPermissionDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  permissionId: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  actorUserId?: string;
}

export class UserActionDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  actorUserId?: string;
}
