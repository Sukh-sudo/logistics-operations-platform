import { IsString } from 'class-validator';

export class UnloadPackageDto {
  @IsString()
  trackingNumber: string;
}