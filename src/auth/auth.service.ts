import {
  Injectable,
  ConflictException,
  UnauthorizedException,
} from '@nestjs/common';
import { UserService } from '../user/user.service';
import { CredentialsService } from './credentials.service';
import { SignupDto } from './dto/sign.dto';
import { SigninDto } from './dto/signin.dto';
import { EmailVerificationService } from './email-verification.service';
import { RefreshTokenService } from './refresh-token.service';

@Injectable()
export class AuthService {
  constructor(
    private readonly userService: UserService,
    private readonly credentialsService: CredentialsService,
    private readonly emailVerificationService: EmailVerificationService,
    private readonly refreshTokenService: RefreshTokenService,
  ) {}

  async signup(signupDto: SignupDto) {
    // 1. Check whether the email is already registered
    const existingUser = await this.userService.findByEmail(signupDto.email);

    if (existingUser) {
      throw new ConflictException('An account with this email already exists');
    }

    // 2. Hash the user's password
    const passwordHash = await this.credentialsService.hashPassword(
      signupDto.password,
    );

    // 3. Create the user in PostgreSQL
    const user = await this.userService.create({
      name: signupDto.name,
      email: signupDto.email,
      password: passwordHash,
    });

    await this.emailVerificationService.sendVerificationEmail(user);

    // 4. Return safe user information
    return {
      message: 'Account created successfully',
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        isEmailVerified: user.isEmailVerified,
        createdAt: user.createdAt,
      },
    };
  }

  async signin(signinDto: SigninDto) {
    const user = await this.userService.findByEmailWithPassword(
      signinDto.email,
    );

    if (!user) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const isPasswordValid = await this.credentialsService.verifyPassword(
      signinDto.password,
      user.password,
    );

    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid email or password');
    }

    if (!user.isEmailVerified) {
      throw new UnauthorizedException(
        'Please verify your email address before signing in',
      );
    }

    if (!user.isEmailVerified) {
      throw new UnauthorizedException(
        'Please verify your email address before signing in',
      );
    }

    const tokens = await this.refreshTokenService.issue(user);

    return {
      message: 'Login successful',
      ...tokens,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
      },
    };
  }
}
