import { IsString, Matches } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { TRAILER_IDENTIFIER_PATTERN } from '../../../common/domain/asset-identifiers';

export class CreateTrailerDto {
  @ApiProperty({
    example: 'TRLR123456',
    description: 'Unique 10-character trailer barcode',})
  @IsString()
  @Matches(TRAILER_IDENTIFIER_PATTERN, {
    message: 'trailerBarcode must be TRLR followed by exactly 6 digits',
  })
  trailerBarcode: string;
}
