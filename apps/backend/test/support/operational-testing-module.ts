import { Test } from '@nestjs/testing';
import { AppModule } from '../../src/app.module';
import { JwtAuthGuard } from '../../src/modules/auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../src/modules/authorization/guards/permissions.guard';
import type { ExecutionContext } from '@nestjs/common';

/**
 * Operational endpoint suites focus on domain transactions. Authentication is
 * covered separately by auth.e2e-spec.ts, so these suites replace the two
 * global security guards and keep the production module graph otherwise unchanged.
 */
export function createOperationalTestingModule() {
  return Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(JwtAuthGuard)
    .useValue({
      canActivate: (context: ExecutionContext) => {
        // Controllers may require the authenticated principal for ownership
        // checks even when these domain-focused suites bypass token parsing.
        context.switchToHttp().getRequest().user = {
          userId: 'integration-administrator',
          email: 'integration-administrator@example.com',
          roles: ['ADMINISTRATOR'],
          permissions: ['system.admin'],
          tokenVersion: 0,
        };
        return true;
      },
    })
    .overrideProvider(PermissionsGuard)
    .useValue({ canActivate: () => true })
    .compile();
}
