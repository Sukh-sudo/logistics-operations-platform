import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Matches,
} from 'class-validator';

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

import { PackageEventType } from '@prisma/client';
import { PACKAGE_IDENTIFIER_PATTERN } from '../../../common/domain/asset-identifiers';

export class CreatePackageEventDto {
  @ApiProperty({
    example: 'CON1234567',
    description: 'Unique 10-character tracking number whose prefix identifies the package type',
  })
  @IsString()
  @Matches(PACKAGE_IDENTIFIER_PATTERN, {
    message: 'trackingNumber must be 10 uppercase characters: MAIL + 6 digits, CON + 7 digits, NCON + 6 digits, or DG + 8 digits',
  })
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
