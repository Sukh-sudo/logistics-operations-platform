import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class ShipmentPackageDto {
  @ApiProperty() @IsString() @IsNotEmpty()
  trackingNumber: string;
}
