import { ApiProperty } from '@nestjs/swagger';
import { HandheldDevicePlatform } from '@prisma/client';
import { IsEnum, IsNotEmpty, IsString, IsUUID, MaxLength } from 'class-validator';

export class EnrollHandheldDeviceDto {
  @ApiProperty({ example: '8c808770-d3c8-4891-8382-f700e919aec3' })
  @IsUUID()
  deviceId: string;

  @ApiProperty({ example: 'YYC Dock Handheld 12' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  displayName: string;

  @ApiProperty({ enum: HandheldDevicePlatform })
  @IsEnum(HandheldDevicePlatform)
  platform: HandheldDevicePlatform;
}
