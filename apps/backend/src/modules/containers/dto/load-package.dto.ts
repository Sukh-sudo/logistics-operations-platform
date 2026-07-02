import { IsString } from 'class-validator';

export class LoadPackageDto {
  @IsString()
  trackingNumber: string;
}