import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ArrayMinSize, ArrayUnique, IsArray, IsInt, IsNotEmpty, IsOptional, IsString, MaxLength, Min } from 'class-validator';

export class CreateShipmentDto {
  @ApiProperty() @IsString() @IsNotEmpty() @MaxLength(40)
  shipmentNumber: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(100)
  referenceNumber?: string;
  @ApiProperty() @IsInt() @Min(1)
  originTerminalId: number;
  @ApiProperty() @IsInt() @Min(1)
  destinationTerminalId: number;
  @ApiProperty({ type: [String] }) @IsArray() @ArrayMinSize(1) @ArrayUnique() @IsString({ each: true }) @IsNotEmpty({ each: true })
  packageTrackingNumbers: string[];
}
