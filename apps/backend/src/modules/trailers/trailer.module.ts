import { Module } from '@nestjs/common';

import { TrailerController } from './controllers/trailer.controller';
import { TrailerService } from './services/trailer.service';
import { PackageModule } from '../packages/package.module';

@Module({
  imports: [PackageModule],
  controllers: [TrailerController],
  providers: [TrailerService],
  exports: [TrailerService],
})
export class TrailerModule {}
