import { IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateContainerDto {
  @ApiProperty({
    example: 'CONT-1001',
    description: 'Unique container barcode',
  })
  @IsString()
  containerBarcode: string;
}