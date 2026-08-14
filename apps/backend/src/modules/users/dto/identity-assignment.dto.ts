import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class AssignRoleDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  roleId: string;
}

export class AssignPermissionDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  permissionId: string;
}
