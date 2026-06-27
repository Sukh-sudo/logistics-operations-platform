import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AuthController } from './controllers/auth.controller';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { AuthService } from './services/auth.service';
import { CredentialService } from './services/credential.service';

@Module({
  imports: [JwtModule.register({})],
  controllers: [AuthController],
  providers: [AuthService, CredentialService, JwtAuthGuard],
  exports: [AuthService, CredentialService, JwtAuthGuard, JwtModule],
})
export class AuthModule {}
