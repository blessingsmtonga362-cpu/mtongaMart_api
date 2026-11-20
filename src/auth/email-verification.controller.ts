import {
  BadRequestException,
  Controller,
  Get,
  Query,
  Res,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Response } from 'express';
import { EmailVerificationService } from './email-verification.service.js';
import { Public } from './decorators/public-route.decorator';
import { escapeHtml } from '../mail/email-template.js';

@Controller('auth')
export class EmailVerificationController {
  constructor(
    private readonly emailVerificationService: EmailVerificationService,
    private readonly config: ConfigService,
  ) {}
  @Public()
  @Get('verify-email')
  async verifyEmail(@Query('token') token: string, @Res() response: Response) {
    try {
      await this.emailVerificationService.verifyEmail(token);
      return response
        .status(200)
        .type('html')
        .send(this.resultPage(true));
    } catch (error) {
      if (!(error instanceof BadRequestException)) throw error;
      return response
        .status(400)
        .type('html')
        .send(this.resultPage(false));
    }
  }

  private resultPage(verified: boolean): string {
    const appUrl = escapeHtml(
      this.config.getOrThrow<string>('APP_URL').replace(/\/+$/, ''),
    );
    const title = verified ? 'Email confirmed' : 'Link unavailable';
    const heading = verified
      ? 'Your email is confirmed.'
      : 'This confirmation link cannot be used.';
    const message = verified
      ? 'Your MtongaMart account is ready. You can return to the app and sign in.'
      : 'The link may have expired or already been used. Return to MtongaMart and request a new confirmation email if you still need one.';
    const buttonLabel = verified ? 'Continue to MtongaMart' : 'Return to MtongaMart';

    return `<!doctype html>
<html lang="en">
  <head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title} | MtongaMart</title></head>
  <body style="margin:0;min-height:100vh;display:grid;place-items:center;padding:24px;box-sizing:border-box;background:#f3f6f4;color:#173a2d;font-family:Arial,Helvetica,sans-serif">
    <main style="width:100%;max-width:480px;box-sizing:border-box;padding:40px 36px;background:#fff;border:1px solid #e2eae5;border-radius:12px">
      <p style="margin:0 0 32px;font-size:21px;font-weight:700;letter-spacing:-.4px">Mtonga<span style="color:#16845b">Mart</span></p>
      <p style="margin:0 0 10px;color:#16845b;font-size:12px;font-weight:700;letter-spacing:1px;text-transform:uppercase">${verified ? 'Account confirmed' : 'Confirmation status'}</p>
      <h1 style="margin:0 0 14px;font-size:27px;line-height:1.25">${heading}</h1>
      <p style="margin:0 0 28px;color:#586b61;font-size:15px;line-height:1.7">${message}</p>
      <a href="${appUrl}" style="display:inline-block;padding:13px 20px;border-radius:7px;background:#147a53;color:#fff;text-decoration:none;font-size:14px;font-weight:700">${buttonLabel}</a>
      <p style="margin:30px 0 0;padding-top:18px;border-top:1px solid #edf1ee;color:#87928c;font-size:12px">You can close this page after returning to the app.</p>
    </main>
  </body>
</html>`;
  }
}
