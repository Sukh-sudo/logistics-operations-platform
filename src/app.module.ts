import { Module } from '@nestjs/common';

import { PrismaModule } from './infrastructure/prisma/prisma.module';
import { PackageModule } from './modules/packages/package.module';

@Module({
  imports: [PrismaModule, PackageModule],
})
export class AppModule {}