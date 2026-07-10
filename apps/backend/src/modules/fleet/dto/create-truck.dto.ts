import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsNotEmpty, IsOptional, IsString, Max, Min } from 'class-validator';

export class CreateTruckDto {
  @ApiProperty({ example: 'TRK-1001' })
  @IsString()
  @IsNotEmpty()
  unitNumber: string;

  @ApiProperty({ example: 'ABC-123' })
  @IsString()
  @IsNotEmpty()
  licensePlate: string;

  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @IsInt()
  terminalId?: number;

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
