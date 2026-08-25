import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { UserStatus } from '@prisma/client';

export class CreateUserDto {
  @ApiProperty({ example: 'EMP00001' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(40)
  employeeNumber: string;

  @ApiPropertyOptional({ example: 'BADGE000001' })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  badgeBarcode?: string;

  @ApiProperty({ example: 'operator@example.com' })
  @IsEmail()
  @MaxLength(254)
  email: string;

  @ApiProperty({ example: 'Taylor' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  firstName: string;

  @ApiProperty({ example: 'Morgan' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  lastName: string;

  @ApiProperty({ minLength: 12 })
  @IsString()
  @MinLength(12)
  @MaxLength(128)
  password: string;

  @ApiPropertyOptional({ enum: UserStatus, default: UserStatus.INACTIVE })
  @IsOptional()
  @IsEnum(UserStatus)
  status?: UserStatus;
}
