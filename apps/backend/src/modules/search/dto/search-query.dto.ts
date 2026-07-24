import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export enum SearchAssetType {
  PACKAGE = 'PACKAGE',
  CONTAINER = 'CONTAINER',
  TRAILER = 'TRAILER',
}

export class SearchQueryDto {
  @ApiProperty({ description: 'Tracking number or asset barcode' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  q: string;

  @ApiPropertyOptional({ enum: SearchAssetType })
  @IsOptional()
  @IsEnum(SearchAssetType)
  type?: SearchAssetType;
}
