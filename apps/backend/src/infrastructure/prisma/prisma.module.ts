import { Global, Module } from '@nestjs/common';
import { ApplicationClock } from '../../common/time/application-clock';
import { PrismaService } from './prisma.service';

@Global()
@Module({
  providers: [ApplicationClock, PrismaService],
  exports: [ApplicationClock, PrismaService],
})
export class PrismaModule {}
