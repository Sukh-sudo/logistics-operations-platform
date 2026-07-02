import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class UpdateTripDto {
  @ApiPropertyOptional()
  @IsOptional() @IsString() @IsNotEmpty()
  equipmentAssignmentId?: string;

  @ApiPropertyOptional()
  @IsOptional() @IsDateString()
  plannedDeparture?: string;
}
