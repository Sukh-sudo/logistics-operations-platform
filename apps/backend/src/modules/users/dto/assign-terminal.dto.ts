import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, Min } from 'class-validator';

export class AssignTerminalDto {
  @ApiProperty() @IsInt() @Min(1)
  terminalId: number;
  @ApiPropertyOptional() @IsOptional() @IsString()
  actorUserId?: string;
}
