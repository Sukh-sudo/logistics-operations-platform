import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsOptional } from 'class-validator';

export class UpdateTripDto {
  @ApiPropertyOptional()
  @IsOptional() @IsDateString()
  plannedDeparture?: string;
}
