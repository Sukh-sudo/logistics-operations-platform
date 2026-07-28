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
} from 'class-validator';

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
  trackingNumber?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  containerBarcode?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  trailerBarcode?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  routeCode?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
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
