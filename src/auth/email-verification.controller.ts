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
    const success = status === 'ok';
    const appUrl = escapeHtml(this.config.getOrThrow<string>('APP_URL').replace(/\/+$/, ''));
    const heading = success ? 'Your email is verified' : 'We couldn’t verify your email';
    const message = success
      ? 'Your MtongaMart account is ready. You can now sign in and start shopping.'
      : 'This link may have expired or already been used. Request a new verification email and try again.';
    const symbol = success ? '✓' : '!';
    const accent = success ? '#16845b' : '#c56b28';
    const action = success
      ? `<a href="${appUrl}" style="display:inline-flex;align-items:center;justify-content:center;min-height:48px;padding:0 24px;border-radius:12px;background:#16845b;color:#fff;text-decoration:none;font-weight:700">Continue to MtongaMart</a>`
      : '<p style="margin:24px 0 0;color:#66736c;font-size:14px;line-height:1.6">Go back to the app and choose <strong>Resend verification email</strong>.</p>';

    return `<!doctype html>
<html lang="en">
  <head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="theme-color" content="#f4f8f5"><title>${success ? 'Email verified' : 'Verification needed'} | MtongaMart</title></head>
  <body style="margin:0;min-height:100vh;display:grid;place-items:center;padding:24px;box-sizing:border-box;background:radial-gradient(circle at 15% 10%,#e4f4e9 0,transparent 35%),#f4f8f5;color:#172b22;font-family:Inter,-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif">
    <main style="width:100%;max-width:460px;box-sizing:border-box;padding:40px 36px;background:#fff;border:1px solid #e5eee8;border-radius:24px;box-shadow:0 24px 70px rgba(26,71,48,.10);text-align:center">
      <div style="margin:0 auto 28px;font-size:22px;font-weight:800;letter-spacing:-.7px;color:#173a2d">Mtonga<span style="color:#16845b">Mart</span></div>
      <div aria-hidden="true" style="width:72px;height:72px;margin:0 auto 24px;display:grid;place-items:center;border-radius:50%;background:${success ? '#e8f6ed' : '#fff3e8'};color:${accent};font-size:36px;font-weight:700">${symbol}</div>
      <p style="margin:0 0 10px;color:${accent};font-size:12px;font-weight:800;letter-spacing:1.5px;text-transform:uppercase">${success ? 'Verification complete' : 'Verification unsuccessful'}</p>
      <h1 style="margin:0 0 14px;font-size:29px;line-height:1.2;letter-spacing:-.8px">${heading}</h1>
      <p style="margin:0;color:#65736b;font-size:15px;line-height:1.75">${message}</p>
      <div style="margin-top:28px">${action}</div>
      <p style="margin:30px 0 0;color:#9aa69f;font-size:12px">${success ? 'Welcome to MtongaMart.' : 'Your account is safe. You can request a fresh link.'}</p>
    </main>
  </body>
</html>`;
  }
}
