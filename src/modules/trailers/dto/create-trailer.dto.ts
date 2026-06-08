import { IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateTrailerDto {
  @ApiProperty({
    example: 'TRL-1001',
    description: 'Unique trailer barcode',})
  @IsString()
  trailerBarcode: string;
}