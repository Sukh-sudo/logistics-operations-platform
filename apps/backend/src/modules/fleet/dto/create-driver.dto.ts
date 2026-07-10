import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateDriverDto {
  @ApiProperty({ example: 'EMP-1001' })
  @IsString()
  @IsNotEmpty()
  employeeId: string;

  @ApiProperty({ example: 'AB-1234567' })
  @IsString()
  @IsNotEmpty()
  licenseNumber: string;

  @ApiProperty({ example: 'Class 1' })
  @IsString()
  @IsNotEmpty()
  licenseClass: string;

  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @IsInt()
  terminalId?: number;
}
