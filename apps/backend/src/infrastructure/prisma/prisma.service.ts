import { Injectable, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { ApplicationClock } from '../../common/time/application-clock';
import { applyScenarioTime } from './scenario-time.middleware';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit {
  constructor(clock: ApplicationClock) {
    super();
    this.$use((params, next) => {
      const instant = clock.scenarioNow();
      if (!instant) return next(params);

      return next(applyScenarioTime(params, instant));
    });
  }

  async onModuleInit() {
    await this.$connect();
  }
}
