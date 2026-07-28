import { ApiProperty } from '@nestjs/swagger';
import { HandheldNetworkState, HandheldTaskType } from '@prisma/client';
import { IsEnum, IsUUID } from 'class-validator';

export class CreateWorkSessionDto {
  @ApiProperty({ enum: HandheldTaskType })
  @IsEnum(HandheldTaskType)
  taskType: HandheldTaskType;

  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  deviceId: string;

  @ApiProperty({ enum: HandheldNetworkState, default: HandheldNetworkState.ONLINE })
  @IsEnum(HandheldNetworkState)
  networkState: HandheldNetworkState = HandheldNetworkState.ONLINE;
}
