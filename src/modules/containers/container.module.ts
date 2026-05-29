import { Module } from '@nestjs/common';

import { ContainerController } from './controllers/container.controller';
import { ContainerService } from './services/container.service';

@Module({
  controllers: [ContainerController],
  providers: [ContainerService],
})
export class ContainerModule {}