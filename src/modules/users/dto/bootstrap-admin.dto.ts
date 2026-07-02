import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsString, MaxLength, MinLength } from 'class-validator';

export class BootstrapAdminDto {
  @ApiProperty({ description: 'Must match BOOTSTRAP_ADMIN_SECRET' })
  @IsString() @IsNotEmpty()
  bootstrapSecret: string;

  @ApiProperty({ example: 'ADMIN-001' })
  @IsString() @IsNotEmpty() @MaxLength(40)
  employeeNumber: string;

  @ApiProperty({ example: 'admin@logistics.local' })
  @IsEmail() @MaxLength(254)
  email: string;

  @ApiProperty({ example: 'System' })
  @IsString() @IsNotEmpty() @MaxLength(80)
  firstName: string;

  @ApiProperty({ example: 'Administrator' })
  @IsString() @IsNotEmpty() @MaxLength(80)
  lastName: string;

  @ApiProperty({ minLength: 12 })
  @IsString() @MinLength(12) @MaxLength(128)
  password: string;
}
