import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PermissionsGuard } from './guards/permissions.guard';
import { RolesGuard } from './guards/roles.guard';

@Module({
  imports: [AuthModule],
  providers: [RolesGuard, PermissionsGuard],
  exports: [AuthModule, RolesGuard, PermissionsGuard],
})
export class AuthorizationModule {}
