import { IsString } from 'class-validator';

export class UnloadContainerDto {
  @IsString()
  containerBarcode: string;
}