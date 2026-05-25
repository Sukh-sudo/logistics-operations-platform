import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
} from 'class-validator';

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

import { PackageEventType } from '@prisma/client';

export class CreatePackageEventDto {
  @ApiProperty({
    example: 'PKG123',
    description: 'Unique package tracking number',
  })
  @IsString()
  trackingNumber: string;

  @ApiProperty({
    enum: PackageEventType,
    example: 'PACKAGE_RECEIVED',
  })
  @IsEnum(PackageEventType)
  eventType: PackageEventType;

  @ApiPropertyOptional({
    example: 1,
    description: 'Terminal where event occurred',
  })
  @IsOptional()
  @IsInt()
  terminalId?: number;

  @ApiPropertyOptional({
    example: 55,
    description: 'Employee performing operation',
  })
  @IsOptional()
  @IsInt()
  employeeId?: number;
}