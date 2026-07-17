import { Type } from 'class-transformer';
import { IsInt, IsOptional, Min } from 'class-validator';

export class FleetAvailabilityQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  terminalId?: number;
}
