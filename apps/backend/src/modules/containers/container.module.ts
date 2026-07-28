import { Module } from '@nestjs/common';

import { ContainerController } from './controllers/container.controller';
import { ContainerService } from './services/container.service';
import { PackageModule } from '../packages/package.module';

@Module({
  imports: [PackageModule],
  controllers: [ContainerController],
  providers: [ContainerService],
  exports: [ContainerService],
})
export class ContainerModule {}
