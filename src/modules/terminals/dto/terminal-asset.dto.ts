import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { TerminalAssetType } from '@prisma/client';
import { IsEnum, IsInt, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class ReceiveTerminalAssetDto {
  @ApiProperty({ enum: TerminalAssetType })
  @IsEnum(TerminalAssetType)
  assetType: TerminalAssetType;

  @ApiProperty({
    example: 'PKG-1001',
    description: 'Tracking number, container barcode, or trailer barcode',
  })
  @IsString()
  @IsNotEmpty()
  assetIdentifier: string;

  @ApiPropertyOptional({ example: 55 })
  @IsOptional()
  @IsInt()
  employeeId?: number;
}

export class TransferTerminalAssetDto extends ReceiveTerminalAssetDto {
  @ApiProperty({ example: 2 })
  @IsInt()
  destinationTerminalId: number;
}
