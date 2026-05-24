import { Module } from '@nestjs/common';
import { PrismaModule } from './infrastructure/prisma/prisma.module';

@Module({
  imports: [PrismaModule],
})
export class AppModule {}