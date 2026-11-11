import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, IsNull, MoreThan } from 'typeorm';
import { randomBytes, createHash } from 'crypto';
import { ConfigService } from '@nestjs/config';

import { Users } from '../user/entities/user.entity.js';
import { EmailVerificationToken } from './entities/email-verification-token.entity.js';
import { MailService } from '../mail/mail.service.js';
import { UserService } from '../user/user.service.js';

@Injectable()
export class EmailVerificationService {
  constructor(
    @InjectRepository(EmailVerificationToken)
    private readonly tokenRepository: Repository<EmailVerificationToken>,
    private readonly dataSource: DataSource,
    private readonly mailService: MailService,
    private readonly configService: ConfigService,
    private readonly userService: UserService,
  ) {}

  async sendVerificationEmail(user: Users) {
    const token = randomBytes(32).toString('hex');

    const tokenHash = createHash('sha256').update(token).digest('hex');

    const expiresAt = new Date(Date.now() + 30 * 60 * 1000);

    await this.tokenRepository.save(
      this.tokenRepository.create({
        userId: user.id,
        tokenHash,
        expiresAt,
        usedAt: null,
      }),
    );

    const appUrl = this.configService
      .getOrThrow<string>('APP_URL')
      .replace(/\/$/, '');

    const verificationLink = `${appUrl}/auth/verify-email?token=${encodeURIComponent(token)}`;

    await this.mailService.sendMail(
      user.email,
      'Verify your MtongaMart account',
      `
        <h2>Welcome to MtongaMart!</h2>
        <p>Please click the link below to verify your email address.</p>
        <a href="${verificationLink}">Verify my email</a>
        <p>This link expires in 30 minutes.</p>
        <p>If you did not create this account, ignore this email.</p>
      `,
    );

    return { message: 'Verification email sent successfully' };
  }

  async verifyEmail(token: string) {
    if (!token) {
      throw new BadRequestException('Verification token is required');
    }

    const tokenHash = createHash('sha256').update(token).digest('hex');

    return this.dataSource.transaction(async (manager) => {
      const tokenRepo = manager.getRepository(EmailVerificationToken);
      const userRepo = manager.getRepository(Users);

      const record = await tokenRepo.findOne({
        where: { tokenHash },
      });

      if (!record) {
        throw new BadRequestException('Invalid verification token');
      }

      if (record.usedAt) {
        throw new BadRequestException(
          'Verification token has already been used',
        );
      }

      const now = new Date();

      if (record.expiresAt <= now) {
        throw new BadRequestException('Verification token has expired');
      }

      // Atomically consume the token so it cannot be reused.
      const result = await tokenRepo.update(
        {
          id: record.id,
          usedAt: IsNull(),
          expiresAt: MoreThan(now),
        },
        { usedAt: now },
      );

      if (result.affected !== 1) {
        throw new BadRequestException('Invalid or expired verification token');
      }

      await userRepo.update({ id: record.userId }, { isEmailVerified: true });

      return { message: 'Email verified successfully. You can now sign in.' };
    });
  }

  async resendVerificationEmail(email: string) {
    const user = await this.userService.findByEmail(email);

    // Return the same response whether the account exists or not.
    if (!user || user.isEmailVerified) {
      return {
        message: 'If verification is needed, a new email will be sent.',
      };
    }

    // Invalidate previous unused verification tokens.
    await this.tokenRepository
      .createQueryBuilder()
      .update(EmailVerificationToken)
      .set({ usedAt: new Date() })
      .where('userId = :userId AND usedAt IS NULL', {
        userId: user.id,
      })
      .execute();

    await this.sendVerificationEmail(user);

    return {
      message: 'If verification is needed, a new email will be sent.',
    };
  }
}
