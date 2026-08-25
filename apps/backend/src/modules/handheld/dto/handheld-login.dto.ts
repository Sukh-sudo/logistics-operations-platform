import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';

export class HandheldLoginDto {
  @ApiProperty({ example: 'BADGE000001' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  badgeBarcode: string;

  @ApiProperty({ example: 'EMP00001' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(40)
  employeeId: string;

  @ApiProperty({ example: '8c808770-d3c8-4891-8382-f700e919aec3' })
  @IsUUID()
  deviceId: string;

  @ApiProperty({
    description: 'Provisioned device secret supplied automatically by the client',
    writeOnly: true,
  })
  @IsString()
  @MinLength(32)
  @MaxLength(128)
  deviceCredential: string;
}
