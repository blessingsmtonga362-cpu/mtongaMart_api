import {
  BadRequestException,
  Controller,
  Get,
  Query,
  Res,
} from '@nestjs/common';
import { Response } from 'express';
import { EmailVerificationService } from './email-verification.service.js';
import { Public } from './decorators/public-route.decorator';

@Controller('auth')
export class EmailVerificationController {
  constructor(
    private readonly emailVerificationService: EmailVerificationService,
  ) {}
  @Public()
  @Get('verify-email')
  async verifyEmail(@Query('token') token: string, @Res() response: Response) {
    try {
      await this.emailVerificationService.verifyEmail(token);
      return response
        .status(200)
        .type('html')
        .send(this.resultPage('ok'));
    } catch (error) {
      if (!(error instanceof BadRequestException)) throw error;
      return response
        .status(400)
        .type('html')
        .send(this.resultPage('error'));
    }
  }

  private resultPage(status: 'ok' | 'error'): string {
    return `<!doctype html>
<html lang="en">
  <head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Email verification</title></head>
  <body style="margin:0;min-height:100vh;display:grid;place-items:center;background:#000;color:#fff;font-family:monospace">
    <pre style="font-size:16px">{status:${status}}</pre>
  </body>
</html>`;
  }
}
