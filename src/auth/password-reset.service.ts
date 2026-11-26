import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { randomBytes, createHash } from 'crypto';
import { ConfigService } from '@nestjs/config';

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
    private readonly configService: ConfigService,
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

    const resetPageUrl = (
      this.configService.get<string>('API_PUBLIC_URL') ||
      this.configService.getOrThrow<string>('APP_URL')
    ).replace(/\/+$/, '');
    const resetLink = `${resetPageUrl}/auth/reset-password?token=${encodeURIComponent(token)}`;

    await this.mailService.sendMail(
      user.email,
      'Reset your MtongaMart password',
      this.passwordResetEmail(resetLink),
    );

    return {
      message: 'If an account exists, a password reset link will be sent.',
    };
  }

  private passwordResetEmail(resetLink: string): string {
    const safeLink = resetLink.replace(/[&<>"']/g, (character) => {
      const entities: Record<string, string> = {
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
      };
      return entities[character];
    });
    return `<!doctype html>
<html lang="en">
  <head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Reset your MtongaMart password</title></head>
  <body style="margin:0;padding:32px 16px;background:#f4f8f5;color:#172b22;font-family:Arial,Helvetica,sans-serif">
    <main style="max-width:480px;margin:0 auto;padding:36px 32px;background:#fff;border:1px solid #e5eee8;border-radius:18px;box-shadow:0 16px 42px rgba(26,71,48,.08)">
      <div style="margin:0 0 28px;font-size:21px;font-weight:800;letter-spacing:-.5px;color:#173a2d">Mtonga<span style="color:#16845b">Mart</span></div>
      <h1 style="margin:0 0 12px;font-size:25px;line-height:1.25">Reset your password</h1>
      <p style="margin:0 0 24px;font-size:15px;line-height:1.65;color:#58685f">We received a request to change your password. Click below to choose a new one.</p>
      <p style="margin:0 0 24px"><a href="${safeLink}" style="display:inline-block;padding:14px 22px;border-radius:10px;background:#16845b;color:#fff;text-decoration:none;font-size:15px;font-weight:700">Choose a new password</a></p>
      <p style="margin:0;padding-top:18px;border-top:1px solid #edf1ee;font-size:13px;line-height:1.6;color:#718078">This secure link expires in 15 minutes. If you didn’t request a reset, you can ignore this email.</p>
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
