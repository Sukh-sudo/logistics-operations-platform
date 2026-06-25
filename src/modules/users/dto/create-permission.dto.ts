import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class CreatePermissionDto {
  @ApiProperty({ example: 'packages.receive' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  code: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(240)
  description?: string;

  @ApiPropertyOptional({ description: 'User performing the action' })
  @IsOptional()
  @IsString()
  actorUserId?: string;
}
