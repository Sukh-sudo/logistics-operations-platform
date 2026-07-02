import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateRouteDto {
  @ApiProperty({ example: 'AB-001' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(30)
  routeNumber: string;

  @ApiProperty({ example: 'Calgary to Edmonton' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name: string;

  @ApiProperty({ example: 1 })
  @IsInt()
  @Min(1)
  originTerminalId: number;

  @ApiProperty({ example: 2 })
  @IsInt()
  @Min(1)
  destinationTerminalId: number;

  @ApiPropertyOptional({ example: 300, description: 'Distance in kilometres' })
  @IsOptional()
  @IsInt()
  @Min(0)
  estimatedDistance?: number;

  @ApiPropertyOptional({ example: 180, description: 'Duration in minutes' })
  @IsOptional()
  @IsInt()
  @Min(0)
  estimatedDuration?: number;
}
