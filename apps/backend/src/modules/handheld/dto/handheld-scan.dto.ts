import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { HandheldAction, HandheldNetworkState } from '@prisma/client';
import {
  IsArray,
  IsDateString,
  IsEnum,
  IsLatitude,
  IsLongitude,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
  IsNotEmpty,
  Matches,
} from 'class-validator';
import {
  CONTAINER_IDENTIFIER_PATTERN,
  PACKAGE_IDENTIFIER_PATTERN,
  TRAILER_IDENTIFIER_PATTERN,
  TRUCK_UNIT_IDENTIFIER_PATTERN,
} from '../../../common/domain/asset-identifiers';

export class HandheldScanDto {
  @ApiProperty({ description: 'Server task-session aggregate ID' })
  @IsString()
  @IsNotEmpty()
  taskSessionId: string;

  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  clientEventId: string;

  @ApiProperty({ enum: HandheldAction })
  @IsEnum(HandheldAction)
  action: HandheldAction;

  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  deviceId: string;

  @ApiProperty({ format: 'date-time' })
  @IsDateString()
  deviceTimestamp: string;

  @ApiProperty({ enum: HandheldNetworkState })
  @IsEnum(HandheldNetworkState)
  networkStateAtCapture: HandheldNetworkState;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Matches(PACKAGE_IDENTIFIER_PATTERN, {
    message: 'trackingNumber must be MAIL + 6 digits, CON + 7 digits, NCON + 6 digits, or DG + 8 digits',
  })
  trackingNumber?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Matches(CONTAINER_IDENTIFIER_PATTERN, {
    message: 'containerBarcode must be MAIL + 6 digits, CON + 7 digits, NCON + 6 digits, or DG + 8 digits',
  })
  containerBarcode?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Matches(TRAILER_IDENTIFIER_PATTERN, {
    message: 'trailerBarcode must be TRLR followed by exactly 6 digits',
  })
  trailerBarcode?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  routeCode?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Matches(TRUCK_UNIT_IDENTIFIER_PATTERN, {
    message: 'truckUnitNumber must be LM or MM, a 3-letter terminal code, and 5 digits',
  })
  truckUnitNumber?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsLatitude()
  latitude?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsLongitude()
  longitude?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100000)
  gpsAccuracyMetres?: number;

  @ApiPropertyOptional({ format: 'date-time' })
  @IsOptional()
  @IsDateString()
  gpsCapturedAt?: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  exceptionFlags?: string[];
}
