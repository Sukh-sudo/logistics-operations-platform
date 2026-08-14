import { ApiProperty } from '@nestjs/swagger';
import { IsInt, Min } from 'class-validator';

export class AssignTerminalDto {
  @ApiProperty() @IsInt() @Min(1)
  terminalId: number;
}
