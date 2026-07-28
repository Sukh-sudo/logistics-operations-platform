import { ApiPropertyOptional } from '@nestjs/swagger';
import { HandheldAction, HandheldTaskType } from '@prisma/client';
import { IsDateString, IsEnum, IsInt, IsOptional, IsString } from 'class-validator';
import { Type } from 'class-transformer';

export class HandheldDashboardQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  terminalId?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  employeeId?: string;

  @ApiPropertyOptional({ enum: HandheldTaskType })
  @IsOptional()
  @IsEnum(HandheldTaskType)
  taskType?: HandheldTaskType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  deviceId?: string;

  @ApiPropertyOptional({ enum: HandheldAction })
  @IsOptional()
  @IsEnum(HandheldAction)
  action?: HandheldAction;

  @ApiPropertyOptional({ format: 'date-time' })
  @IsOptional()
  @IsDateString()
  from?: string;

  @ApiPropertyOptional({ format: 'date-time' })
  @IsOptional()
  @IsDateString()
  to?: string;
}
