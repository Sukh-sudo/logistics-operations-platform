import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

export class UpdateRouteDto {
  @ApiPropertyOptional({ example: 'AB-001' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(30)
  routeNumber?: string;

  @ApiPropertyOptional({ example: 'Calgary to Edmonton' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name?: string;

  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  originTerminalId?: number;

  @ApiPropertyOptional({ example: 2 })
  @IsOptional()
  @IsInt()
  @Min(1)
  destinationTerminalId?: number;

  @ApiPropertyOptional({ example: 300 })
  @IsOptional()
  @IsInt()
  @Min(0)
  estimatedDistance?: number;

  @ApiPropertyOptional({ example: 180 })
  @IsOptional()
  @IsInt()
  @Min(0)
  estimatedDuration?: number;
}
