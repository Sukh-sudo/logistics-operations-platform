import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsOptional } from 'class-validator';
import { ListQueryDto } from '../../../common/dto/list-query.dto';

export class NotificationQueryDto extends ListQueryDto {
  @ApiPropertyOptional({
    description: 'Only return notifications for this customer inbox',
  })
  @IsOptional()
  @IsEmail()
  recipient?: string;
}
