import { Module } from '@nestjs/common';

import { TrailerController } from './controllers/trailer.controller';
import { TrailerService } from './services/trailer.service';

@Module({
  controllers: [TrailerController],
  providers: [TrailerService],
})
export class TrailerModule {}