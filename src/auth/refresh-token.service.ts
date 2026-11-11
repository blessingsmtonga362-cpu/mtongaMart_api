import { Injectable, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, IsNull } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import { randomBytes, createHash, randomUUID } from 'crypto';

import { RefreshToken } from './entities/refresh-token.entity.js';
import { Users } from '../user/entities/user.entity.js';

@Injectable()
export class RefreshTokenService {
  constructor(
    @InjectRepository(RefreshToken)
    private readonly refreshRepository: Repository<RefreshToken>,
    private readonly dataSource: DataSource,
    private readonly jwtService: JwtService,
  ) {}

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  private async createAccessToken(user: Users) {
    return this.jwtService.signAsync({
      sub: user.id,
      email: user.email,
    });
  }

  private async createRefreshToken(
    userId: number,
    familyId: string,
    repository: Repository<RefreshToken>,
  ) {
    const token = randomBytes(32).toString('hex');

    await repository.save(
      repository.create({
        userId,
        familyId,
        tokenHash: this.hashToken(token),
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        revokedAt: null,
      }),
    );

    return token;
  }

  async issue(user: Users) {
    const familyId = randomUUID();

    const refreshToken = await this.createRefreshToken(
      user.id,
      familyId,
      this.refreshRepository,
    );

    const accessToken = await this.createAccessToken(user);

    return { accessToken, refreshToken };
  }

  async rotate(token: string) {
    if (!token) {
      throw new UnauthorizedException('Refresh token is required');
    }

    const tokenHash = this.hashToken(token);

    const outcome = await this.dataSource.transaction(async (manager) => {
      const repository = manager.getRepository(RefreshToken);

      const storedToken = await repository.findOne({
        where: { tokenHash },
        lock: { mode: 'pessimistic_write' },
      });

      if (!storedToken) {
        return { error: 'invalid' as const };
      }

      // Reuse of a previously revoked token indicates possible theft.
      if (storedToken.revokedAt) {
        await repository.update(
          { familyId: storedToken.familyId, revokedAt: IsNull() },
          { revokedAt: new Date() },
        );

        return { error: 'reuse' as const };
      }

      if (storedToken.expiresAt <= new Date()) {
        return { error: 'expired' as const };
      }

      const newRefreshToken = await this.createRefreshToken(
        storedToken.userId,
        storedToken.familyId,
        repository,
      );

      await repository.update(
        { id: storedToken.id, revokedAt: IsNull() },
        { revokedAt: new Date() },
      );

      const user = await manager.getRepository(Users).findOne({
        where: { id: storedToken.userId },
      });

      if (!user || !user.isEmailVerified) {
        return { error: 'invalid' as const };
      }

      return {
        user,
        refreshToken: newRefreshToken,
      };
    });

    // Throw outside the transaction so reuse-triggered revocation commits.
    if ('error' in outcome) {
      throw new UnauthorizedException(
        outcome.error === 'reuse'
          ? 'Refresh token reuse detected. Please sign in again.'
          : 'Invalid or expired refresh token',
      );
    }

    const accessToken = await this.createAccessToken(outcome.user);

    return {
      accessToken,
      refreshToken: outcome.refreshToken,
    };
  }

  async revoke(token: string) {
    if (!token) {
      throw new UnauthorizedException('Refresh token is required');
    }

    const storedToken = await this.refreshRepository.findOne({
      where: { tokenHash: this.hashToken(token) },
    });

    if (storedToken && !storedToken.revokedAt) {
      await this.refreshRepository.update(
        { familyId: storedToken.familyId, revokedAt: IsNull() },
        { revokedAt: new Date() },
      );
    }

    return { message: 'Logged out successfully' };
  }
  async revokeAllForUser(userId: number) {
    await this.refreshRepository
      .createQueryBuilder()
      .update(RefreshToken)
      .set({ revokedAt: new Date() })
      .where('userId = :userId AND revokedAt IS NULL', { userId })
      .execute();
  }
}
