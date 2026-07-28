import { ApiProperty } from '@nestjs/swagger';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsNotEmpty, IsString, IsUUID, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { HandheldScanDto } from './handheld-scan.dto';

export class HandheldSyncDto {
  @ApiProperty({ description: 'Server task-session aggregate ID' })
  @IsString()
  @IsNotEmpty()
  taskSessionId: string;

  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  batchId: string;

  @ApiProperty({ type: [HandheldScanDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => HandheldScanDto)
  events: HandheldScanDto[];
}
