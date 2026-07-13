import { IsNotEmpty, IsString } from 'class-validator';

export class AssignEquipmentDto {
  @IsString()
  @IsNotEmpty()
  tripId!: string;

  @IsString()
  @IsNotEmpty()
  truckId!: string;

  @IsString()
  @IsNotEmpty()
  driverId!: string;
}
