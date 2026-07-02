import { Module } from '@nestjs/common';
import { UserController } from './controllers/user.controller';
import { UserService } from './services/user.service';
import { AuthModule } from '../auth/auth.module';
import { AuthorizationModule } from '../authorization/authorization.module';
import { BootstrapAdminController } from './controllers/bootstrap-admin.controller';

@Module({
  imports: [AuthModule, AuthorizationModule],
  controllers: [UserController, BootstrapAdminController],
  providers: [UserService],
  exports: [UserService],
})
export class UserModule {}
