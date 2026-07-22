import { Type } from 'class-transformer';
import { IsDateString, IsEnum, IsInt, IsOptional, Matches, Min } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { PackageStatus, TrailerStatus } from '@prisma/client';

/**
 * Optional filters shared by the dashboard summary and recent-activity reads.
 * Calendar dates are interpreted as inclusive UTC days by DashboardService.
 */
export class DashboardQueryDto {
  @ApiPropertyOptional({ example: '2026-07-01', format: 'date' })
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  @IsDateString({ strict: true })
  fromDate?: string;

  @ApiPropertyOptional({ example: '2026-07-22', format: 'date' })
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  @IsDateString({ strict: true })
  toDate?: string;

  @ApiPropertyOptional({ example: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  terminalId?: number;

  @ApiPropertyOptional({ enum: PackageStatus })
  @IsOptional()
  @IsEnum(PackageStatus)
  packageStatus?: PackageStatus;

  @ApiPropertyOptional({ enum: TrailerStatus })
  @IsOptional()
  @IsEnum(TrailerStatus)
  trailerStatus?: TrailerStatus;
}
