import { IsString } from 'class-validator';

export class LoadContainerDto {
  @IsString()
  containerBarcode: string;
}