import { Module } from '@nestjs/common';
import { RouteController } from './controllers/route.controller';
import { RouteService } from './services/route.service';

@Module({
  controllers: [RouteController],
  providers: [RouteService],
  exports: [RouteService],
})
export class RouteModule {}
