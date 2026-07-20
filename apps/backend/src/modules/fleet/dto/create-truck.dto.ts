import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { TruckPurpose } from '@prisma/client';
import { IsEnum, IsInt, IsNotEmpty, IsOptional, IsString, Max, Min } from 'class-validator';

export class CreateTruckDto {
  @ApiProperty({ enum: TruckPurpose, example: TruckPurpose.LAST_MILE })
  @IsEnum(TruckPurpose)
  purpose: TruckPurpose;

  @ApiProperty({ example: 'ABC-123' })
  @IsString()
  @IsNotEmpty()
  licensePlate: string;

  @ApiProperty({ example: 1, description: 'Owning terminal used in the generated unit number.' })
  @IsInt()
  terminalId: number;

  @ApiPropertyOptional({ example: 2024 })
  @IsOptional()
  @IsInt()
  @Min(1980)
  @Max(2100)
  year?: number;

  @ApiPropertyOptional({ example: 'Freightliner' })
  @IsOptional()
  @IsString()
  make?: string;

  @ApiPropertyOptional({ example: 'Cascadia' })
  @IsOptional()
  @IsString()
  model?: string;
}
