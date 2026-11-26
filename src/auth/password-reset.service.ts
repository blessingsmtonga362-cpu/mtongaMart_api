import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { randomBytes, createHash } from 'crypto';

import { PasswordResetToken } from './entities/password-reset-token.entity.js';
import { UserService } from '../user/user.service.js';
import { CredentialsService } from './credentials.service.js';
import { MailService } from '../mail/mail.service.js';
import { Users } from '../user/entities/user.entity.js';
import { RefreshTokenService } from './refresh-token.service.js';

@Injectable()
export class PasswordResetService {
  constructor(
    @InjectRepository(PasswordResetToken)
    private readonly resetTokenRepository: Repository<PasswordResetToken>,

    private readonly dataSource: DataSource,
    private readonly userService: UserService,
    private readonly credentialsService: CredentialsService,
    private readonly mailService: MailService,
    private readonly refreshTokenService: RefreshTokenService,
  ) {}

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  async forgotPassword(email: string) {
    const user = await this.userService.findByEmail(email);

    // Do not reveal whether an email address is registered.
    if (!user) {
      return {
        message: 'If an account exists, a password reset link will be sent.',
      };
    }

    // Invalidate previous unused reset tokens.
    await this.resetTokenRepository
      .createQueryBuilder()
      .update(PasswordResetToken)
      .set({ usedAt: new Date() })
      .where('userId = :userId AND usedAt IS NULL', {
        userId: user.id,
      })
      .execute();

    const token = randomBytes(32).toString('hex');

    const resetToken = this.resetTokenRepository.create({
      userId: user.id,
      tokenHash: this.hashToken(token),
      expiresAt: new Date(Date.now() + 15 * 60 * 1000),
      usedAt: null,
    });

    await this.resetTokenRepository.save(resetToken);

    await this.mailService.sendMail(
      user.email,
      'Your MtongaMart password reset code',
      this.passwordResetEmail(token),
    );

    return {
      message: 'If an account exists, a password reset link will be sent.',
    };
  }

  private passwordResetEmail(token: string): string {
    return `<!doctype html>
<html lang="en">
  <head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Password reset code</title></head>
  <body style="margin:0;padding:24px;background:#f4f5f4;color:#202520;font-family:Arial,Helvetica,sans-serif">
    <main style="max-width:480px;margin:0 auto;padding:28px;background:#fff;border-radius:8px">
      <h1 style="margin:0 0 16px;font-size:22px">Reset your password</h1>
      <p style="font-size:15px;line-height:1.6">Enter this code in MtongaMart to choose a new password:</p>
      <p style="margin:24px 0;padding:16px;background:#f2f5f3;text-align:center;font-family:monospace;font-size:24px;letter-spacing:2px;word-break:break-all">${token}</p>
      <p style="font-size:13px;line-height:1.6;color:#59625c">This code expires in 15 minutes. If you did not request a reset, you can ignore this email.</p>
    </main>
  </body>
</html>`;
  }

  async resetPassword(token: string, newPassword: string) {
    const tokenHash = this.hashToken(token);

    const result = await this.dataSource.transaction(async (manager) => {
      const tokenRepository = manager.getRepository(PasswordResetToken);

      const resetToken = await tokenRepository.findOne({
        where: { tokenHash },
        lock: { mode: 'pessimistic_write' },
      });

      if (
        !resetToken ||
        resetToken.usedAt ||
        resetToken.expiresAt.getTime() <= Date.now()
      ) {
        throw new BadRequestException('Invalid or expired password reset link');
      }

      const userRepository = manager.getRepository(Users);

      const user = await userRepository.findOne({
        where: { id: resetToken.userId },
      });

      if (!user) {
        throw new BadRequestException('Invalid password reset link');
      }

      user.password = await this.credentialsService.hashPassword(newPassword);

      await userRepository.save(user);

      resetToken.usedAt = new Date();
      await tokenRepository.save(resetToken);

      // Invalidate other outstanding reset links.
      await tokenRepository
        .createQueryBuilder()
        .update(PasswordResetToken)
        .set({ usedAt: new Date() })
        .where('userId = :userId AND usedAt IS NULL', {
          userId: user.id,
        })
        .execute();

      return user.id;
    });
    await this.refreshTokenService.revokeAllForUser(result);

    return {
      message: 'Password reset successfully. Please sign in again.',
      userId: result,
    };
  }
}
