import { IsString } from 'class-validator';

export class CreateContainerDto {
  @IsString()
  containerBarcode: string;
}