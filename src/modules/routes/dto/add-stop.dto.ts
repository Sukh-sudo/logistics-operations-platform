import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, Min } from 'class-validator';

export class AddStopDto {
  @ApiProperty({ example: 3 })
  @IsInt()
  @Min(1)
  terminalId: number;

  @ApiPropertyOptional({ example: 1, description: 'One-based stop position' })
  @IsOptional()
  @IsInt()
  @Min(1)
  sequence?: number;

  @ApiProperty({ example: 90, description: 'Minutes after route departure' })
  @IsInt()
  @Min(0)
  estimatedArrivalOffset: number;

  @ApiProperty({ example: 105, description: 'Minutes after route departure' })
  @IsInt()
  @Min(0)
  estimatedDepartureOffset: number;
}
