import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UserEventType, UserStatus } from '@prisma/client';
import { createHash, randomBytes, randomUUID } from 'crypto';
import { PrismaService } from '../../../infrastructure/prisma/prisma.service';
import {
  ACCESS_TOKEN_TTL_SECONDS,
  REFRESH_TOKEN_TTL_MS,
  accessTokenSecret,
} from '../auth.constants';
import { ChangePasswordDto } from '../dto/change-password.dto';
import { LoginDto } from '../dto/login.dto';
import type { AccessTokenPayload } from '../interfaces/authenticated-user.interface';
import { CredentialService } from './credential.service';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly credentials: CredentialService,
  ) {}

  async login(dto: LoginDto, requestId?: string) {
    const email = dto.email.trim().toLowerCase();
    return this.prisma.$transaction(async (tx) => {
      const current = await tx.user.findUnique({
        where: { email },
        include: { snapshot: true },
      });
      if (
        !current?.passwordHash ||
        current.snapshot?.currentStatus !== UserStatus.ACTIVE ||
        !(await this.credentials.verifyPassword(
          dto.password,
          current.passwordHash,
        ))
      ) {
        throw new UnauthorizedException('Invalid credentials');
      }

      const issued = await this.issueTokens(
        current.id,
        current.email,
        current.tokenVersion,
        current.snapshot.roleNames,
        current.snapshot.permissions,
      );
      await tx.refreshToken.create({ data: issued.refreshTokenRecord });
      const event = await tx.userEvent.create({
        data: {
          userId: current.id,
          eventType: UserEventType.USER_AUTHENTICATED,
          actorUserId: current.id,
          correlationId: requestId ?? randomUUID(),
        },
      });
      await tx.userSnapshot.update({
        where: { userId: current.id },
        data: {
          lastLoginAt: event.createdAt,
          lastActivityAt: event.createdAt,
        },
      });

      return issued.response;
    });
  }

  refresh(refreshToken: string, requestId?: string) {
    const tokenHash = this.hashToken(refreshToken);
    return this.prisma.$transaction(async (tx) => {
      const stored = await tx.refreshToken.findUnique({
        where: { tokenHash },
        include: { user: { include: { snapshot: true } } },
      });
      const now = new Date();
      if (
        !stored ||
        stored.revokedAt ||
        stored.expiresAt <= now ||
        stored.user.snapshot?.currentStatus !== UserStatus.ACTIVE
      ) {
        throw new UnauthorizedException('Invalid refresh token');
      }

      await tx.refreshToken.update({
        where: { id: stored.id },
        data: { revokedAt: now },
      });
      const snapshot = stored.user.snapshot;
      const issued = await this.issueTokens(
        stored.user.id,
        stored.user.email,
        stored.user.tokenVersion,
        snapshot.roleNames,
        snapshot.permissions,
      );
      await tx.refreshToken.create({ data: issued.refreshTokenRecord });
      const event = await tx.userEvent.create({
        data: {
          userId: stored.user.id,
          eventType: UserEventType.REFRESH_TOKEN_ROTATED,
          actorUserId: stored.user.id,
          correlationId: requestId ?? randomUUID(),
          payload: { revokedRefreshTokenId: stored.id },
        },
      });
      await tx.userSnapshot.update({
        where: { userId: stored.user.id },
        data: { lastActivityAt: event.createdAt },
      });

      return issued.response;
    });
  }

  logout(userId: string, refreshToken: string, requestId?: string) {
    const tokenHash = this.hashToken(refreshToken);
    return this.prisma.$transaction(async (tx) => {
      const stored = await tx.refreshToken.findUnique({ where: { tokenHash } });
      if (!stored || stored.userId !== userId || stored.revokedAt) {
        throw new UnauthorizedException('Invalid refresh token');
      }

      const revokedAt = new Date();
      await tx.refreshToken.update({
        where: { id: stored.id },
        data: { revokedAt },
      });
      const event = await tx.userEvent.create({
        data: {
          userId,
          eventType: UserEventType.USER_LOGGED_OUT,
          actorUserId: userId,
          correlationId: requestId ?? randomUUID(),
          payload: { revokedRefreshTokenId: stored.id },
        },
      });
      await tx.userSnapshot.update({
        where: { userId },
        data: { lastActivityAt: event.createdAt },
      });

      return { loggedOut: true };
    });
  }

  async changePassword(
    userId: string,
    dto: ChangePasswordDto,
    requestId?: string,
  ) {
    if (dto.currentPassword === dto.newPassword) {
      throw new BadRequestException('New password must be different');
    }
    const passwordHash = await this.credentials.hashPassword(dto.newPassword);

    return this.prisma.$transaction(async (tx) => {
      const current = await tx.user.findUnique({ where: { id: userId } });
      if (
        !current?.passwordHash ||
        !(await this.credentials.verifyPassword(
          dto.currentPassword,
          current.passwordHash,
        ))
      ) {
        throw new UnauthorizedException('Current password is invalid');
      }
      await tx.user.update({
        where: { id: userId },
        data: { passwordHash, tokenVersion: { increment: 1 } },
      });
      await tx.refreshToken.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      const event = await tx.userEvent.create({
        data: {
          userId,
          eventType: UserEventType.PASSWORD_CHANGED,
          actorUserId: userId,
          correlationId: requestId ?? randomUUID(),
        },
      });
      await tx.userSnapshot.update({
        where: { userId },
        data: { lastActivityAt: event.createdAt },
      });

      return { passwordChanged: true };
    });
  }

  async getCurrentUser(userId: string) {
    const snapshot = await this.prisma.userSnapshot.findUnique({
      where: { userId },
    });
    if (!snapshot || snapshot.currentStatus !== UserStatus.ACTIVE) {
      throw new UnauthorizedException();
    }
    return snapshot;
  }

  private async issueTokens(
    userId: string,
    email: string,
    tokenVersion: number,
    roles: string[],
    permissions: string[],
  ) {
    const payload: AccessTokenPayload = {
      sub: userId,
      email,
      roles,
      permissions,
      tokenVersion,
      type: 'access',
    };
    const accessToken = await this.jwtService.signAsync(payload, {
      secret: accessTokenSecret(),
      expiresIn: ACCESS_TOKEN_TTL_SECONDS,
    });
    const refreshToken = randomBytes(48).toString('base64url');
    const expiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL_MS);

    return {
      response: {
        accessToken,
        refreshToken,
        tokenType: 'Bearer',
        expiresIn: ACCESS_TOKEN_TTL_SECONDS,
      },
      refreshTokenRecord: {
        userId,
        tokenHash: this.hashToken(refreshToken),
        expiresAt,
      },
    };
  }

  private hashToken(token: string) {
    return createHash('sha256').update(token).digest('hex');
  }
}
