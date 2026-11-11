import { Controller, Get, Query } from '@nestjs/common';
import { EmailVerificationService } from './email-verification.service.js';
import { Public } from './decorators/public.decorator.js';

@Controller('auth')
export class EmailVerificationController {
  constructor(
    private readonly emailVerificationService: EmailVerificationService,
  ) {}
  @Public()
  @Get('verify-email')
  verifyEmail(@Query('token') token: string) {
    return this.emailVerificationService.verifyEmail(token);
  }
}
