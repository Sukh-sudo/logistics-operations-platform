import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { TerminalStatus } from '@prisma/client';

export class UpdateTerminalDto {
  @ApiPropertyOptional({ example: 'YYC' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  terminalCode?: string;

  @ApiPropertyOptional({ example: 'Calgary' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  city?: string;

  @ApiPropertyOptional({ example: 'Alberta' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  province?: string;

  @ApiPropertyOptional({ example: 'Canada' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  country?: string;

  @ApiPropertyOptional({ example: 'America/Edmonton' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  timezone?: string;

  @ApiPropertyOptional({ enum: TerminalStatus })
  @IsOptional()
  @IsEnum(TerminalStatus)
  status?: TerminalStatus;
}
