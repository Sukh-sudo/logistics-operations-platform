import { ApiPropertyOptional } from '@nestjs/swagger';
import { ContainerStatus } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsDateString, IsEnum, IsInt, IsOptional, Matches, Min } from 'class-validator';

export class ContainerListQueryDto {
  @ApiPropertyOptional({ example: '2026-07-01', format: 'date' })
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  @IsDateString({ strict: true })
  fromDate?: string;

  @ApiPropertyOptional({ example: '2026-07-31', format: 'date' })
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  @IsDateString({ strict: true })
  toDate?: string;

  @ApiPropertyOptional({ example: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  originTerminalId?: number;

  @ApiPropertyOptional({ example: 2, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  destinationTerminalId?: number;

  @ApiPropertyOptional({ enum: ContainerStatus })
  @IsOptional()
  @IsEnum(ContainerStatus)
  status?: ContainerStatus;
}
