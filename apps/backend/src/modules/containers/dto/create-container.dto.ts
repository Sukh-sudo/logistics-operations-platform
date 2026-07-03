import { IsString, Matches } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { CONTAINER_IDENTIFIER_PATTERN } from '../../../common/domain/asset-identifiers';

export class CreateContainerDto {
  @ApiProperty({
    example: 'CON1234567',
    description: 'Unique 10-character barcode whose prefix identifies the accepted package type',
  })
  @IsString()
  @Matches(CONTAINER_IDENTIFIER_PATTERN, {
    message: 'containerBarcode must be 10 uppercase characters: MAIL + 6 digits, CON + 7 digits, NCON + 6 digits, or DG + 8 digits',
  })
  containerBarcode: string;
}
