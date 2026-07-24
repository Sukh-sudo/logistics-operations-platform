import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsOptional } from 'class-validator';

export class NotificationQueryDto {
  @ApiPropertyOptional({
    description: 'Only return notifications for this customer inbox',
  })
  @IsOptional()
  @IsEmail()
  recipient?: string;
}
