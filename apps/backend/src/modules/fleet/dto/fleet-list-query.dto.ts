import { ApiPropertyOptional } from '@nestjs/swagger';
import { DriverStatus, EquipmentAssignmentStatus, TruckStatus } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, Min } from 'class-validator';

class TerminalQueryDto {
  @ApiPropertyOptional({ example: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  terminalId?: number;
}

export class TruckListQueryDto extends TerminalQueryDto {
  @ApiPropertyOptional({ enum: TruckStatus })
  @IsOptional()
  @IsEnum(TruckStatus)
  status?: TruckStatus;
}

export class DriverListQueryDto extends TerminalQueryDto {
  @ApiPropertyOptional({ enum: DriverStatus })
  @IsOptional()
  @IsEnum(DriverStatus)
  status?: DriverStatus;
}

export class AssignmentListQueryDto extends TerminalQueryDto {
  @ApiPropertyOptional({ enum: EquipmentAssignmentStatus })
  @IsOptional()
  @IsEnum(EquipmentAssignmentStatus)
  status?: EquipmentAssignmentStatus;
}
