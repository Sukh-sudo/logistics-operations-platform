import { IsEnum, IsInt, IsOptional, IsString } from 'class-validator';
import { PackageEventType } from '@prisma/client';

export class CreatePackageEventDto {
  @IsString()
  trackingNumber: string;

  @IsEnum(PackageEventType)
  eventType: PackageEventType;

  @IsOptional()
  @IsInt()
  terminalId?: number;

  @IsOptional()
  @IsInt()
  employeeId?: number;
}