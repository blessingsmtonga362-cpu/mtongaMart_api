import { Module } from '@nestjs/common';
import { UserModule } from '../user/user.module';
import { CredentialsService } from './credentials.service';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtModule } from 'node_modules/@nestjs/jwt/dist/jwt.module';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MailModule } from '../mail/mail.module';
import { EmailVerificationToken } from './entities/email-verification-token.entity';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EmailVerificationService } from './email-verification.service';
import { EmailVerificationController } from './email-verification.controller';
import { RefreshToken } from './entities/refresh-token.entity';
import { RefreshTokenService } from './refresh-token.service';
import { SecurityModule } from './security.module';
import { PasswordResetToken } from './entities/password-reset-token.entity';
import { PasswordResetService } from './password-reset.service';
@Module({
  imports: [
    UserModule,
    MailModule,
    TypeOrmModule.forFeature([
      EmailVerificationToken,
      RefreshToken,
      PasswordResetToken,
    ]),
    SecurityModule,
  ],
  controllers: [AuthController, EmailVerificationController],
  providers: [
    CredentialsService,
    AuthService,
    EmailVerificationService,
    RefreshTokenService,
    PasswordResetService,
  ],
})
export class AuthModule {}
