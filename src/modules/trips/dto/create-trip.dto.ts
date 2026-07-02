import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateTripDto {
  @ApiProperty({ example: 'TRIP-2026-001' })
  @IsString() @IsNotEmpty() @MaxLength(40)
  tripNumber: string;

  @ApiProperty()
  @IsString() @IsNotEmpty()
  routeId: string;

  @ApiPropertyOptional()
  @IsOptional() @IsString() @IsNotEmpty()
  equipmentAssignmentId?: string;

  @ApiProperty({ example: '2026-07-02T14:00:00.000Z' })
  @IsDateString()
  plannedDeparture: string;
}
