import { Test } from '@nestjs/testing';
import { AppModule } from '../../src/app.module';
import { JwtAuthGuard } from '../../src/modules/auth/guards/jwt-auth.guard';

/**
 * Operational endpoint suites focus on domain transactions. Authentication is
 * covered separately by auth.e2e-spec.ts, so these suites replace only the
 * global JWT guard and keep the production module graph otherwise unchanged.
 */
export function createOperationalTestingModule() {
  return Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(JwtAuthGuard)
    .useValue({ canActivate: () => true })
    .compile();
}
