import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { TerminalStatus } from '@prisma/client';

export class CreateTerminalDto {
  @ApiProperty({ example: 'YYC' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  terminalCode: string;

  @ApiProperty({ example: 'Calgary Distribution Centre' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name: string;

  @ApiProperty({ example: 'Calgary' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  city: string;

  @ApiProperty({ example: 'Alberta' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  province: string;

  @ApiProperty({ example: 'Canada' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  country: string;

  @ApiProperty({ example: 'America/Edmonton' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  timezone: string;

  @ApiPropertyOptional({ enum: TerminalStatus, default: TerminalStatus.ACTIVE })
  @IsOptional()
  @IsEnum(TerminalStatus)
  status?: TerminalStatus;
}
