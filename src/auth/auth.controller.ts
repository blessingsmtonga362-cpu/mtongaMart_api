import { Controller, Post, Body, Get, Query, Res } from '@nestjs/common';
import { Response } from 'express';
import { AuthService } from './auth.service';
import { SignupDto } from './dto/sign.dto';
import { SigninDto } from './dto/signin.dto';
import { RefreshTokenService } from './refresh-token.service';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { Throttle } from '@nestjs/throttler';
import { Public } from './decorators/public-route.decorator';
import { PasswordResetService } from './password-reset.service';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { EmailVerificationService } from './email-verification.service';
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly refreshTokenService: RefreshTokenService,
    private readonly passwordResetService: PasswordResetService,
    private readonly emailVerificationService: EmailVerificationService,
  ) {}
  @Public()
  @Post('signup')
  signup(@Body() signupDto: SignupDto) {
    return this.authService.signup(signupDto);
  }
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Public()
  @Post('signin')
  signin(@Body() signinDto: SigninDto) {
    return this.authService.signin(signinDto);
  }

  @Public()
  @Post('refresh')
  refresh(@Body() dto: RefreshTokenDto) {
    return this.refreshTokenService.rotate(dto.refreshToken);
  }

  @Public()
  @Post('logout')
  logout(@Body() dto: RefreshTokenDto) {
    return this.refreshTokenService.revoke(dto.refreshToken);
  }

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Post('forgot-password')
  forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.passwordResetService.forgotPassword(dto.email);
  }

  @Public()
  @Post('reset-password')
  resetPassword(@Body() dto: ResetPasswordDto) {
    return this.passwordResetService.resetPassword(dto.token, dto.newPassword);
  }

  @Public()
  @Get('reset-password')
  resetPasswordPage(@Query('token') token: string, @Res() response: Response) {
    const safeToken = JSON.stringify(token ?? '').replace(/</g, '\\u003c');

    return response.type('html').send(`<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
    <meta name="theme-color" content="#f4f8f5"><title>Reset your password | MtongaMart</title>
  </head>
  <body style="margin:0;min-height:100vh;display:grid;place-items:center;padding:24px;box-sizing:border-box;background:radial-gradient(circle at 15% 10%,#e4f4e9 0,transparent 35%),#f4f8f5;color:#172b22;font-family:Inter,-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif">
    <main style="width:100%;max-width:460px;box-sizing:border-box;padding:40px 36px;background:#fff;border:1px solid #e5eee8;border-radius:24px;box-shadow:0 24px 70px rgba(26,71,48,.10)">
      <div style="margin-bottom:30px;text-align:center;font-size:22px;font-weight:800;letter-spacing:-.7px;color:#173a2d">Mtonga<span style="color:#16845b">Mart</span></div>
      <div id="reset-content">
        <p style="margin:0 0 9px;color:#16845b;font-size:12px;font-weight:800;letter-spacing:1.5px;text-transform:uppercase">Account security</p>
        <h1 style="margin:0 0 10px;font-size:29px;line-height:1.2;letter-spacing:-.8px">Create a new password</h1>
        <p style="margin:0 0 26px;color:#65736b;font-size:15px;line-height:1.65">Choose a strong password you haven’t used before.</p>
        <form id="reset-form">
          <label for="new-password" style="display:block;margin-bottom:8px;font-size:14px;font-weight:700">New password</label>
          <input id="new-password" name="newPassword" type="password" autocomplete="new-password" minlength="12" maxlength="128" required style="width:100%;box-sizing:border-box;padding:14px 15px;border:1px solid #dce6df;border-radius:11px;font-size:15px;outline-color:#16845b">
          <label for="confirm-password" style="display:block;margin:19px 0 8px;font-size:14px;font-weight:700">Confirm new password</label>
          <input id="confirm-password" type="password" autocomplete="new-password" minlength="12" maxlength="128" required style="width:100%;box-sizing:border-box;padding:14px 15px;border:1px solid #dce6df;border-radius:11px;font-size:15px;outline-color:#16845b">
          <p style="margin:9px 0 0;color:#7b8880;font-size:12px">Use at least 12 characters.</p>
          <p id="reset-message" role="status" style="min-height:20px;margin:13px 0 0;color:#b23d35;font-size:13px;line-height:1.5"></p>
          <button id="reset-button" type="submit" style="width:100%;min-height:50px;margin-top:10px;border:0;border-radius:12px;background:#16845b;color:#fff;font-size:15px;font-weight:700;cursor:pointer">Save new password</button>
        </form>
      </div>
      <p id="footer" style="margin:28px 0 0;text-align:center;color:#9aa69f;font-size:12px">Password reset links expire after 15 minutes.</p>
    </main>
    <script>
      const resetToken = ${safeToken};
      const form = document.getElementById('reset-form');
      const message = document.getElementById('reset-message');
      if (!resetToken) {
        form.hidden = true;
        message.textContent = 'This reset link is incomplete. Request a new password reset email and try again.';
      }
      form.addEventListener('submit', async (event) => {
        event.preventDefault();
        const newPassword = document.getElementById('new-password').value;
        const confirmPassword = document.getElementById('confirm-password').value;
        const button = document.getElementById('reset-button');
        if (newPassword !== confirmPassword) {
          message.textContent = 'Those passwords do not match. Please check and try again.';
          return;
        }
        button.disabled = true;
        button.textContent = 'Updating password…';
        message.style.color = '#65736b';
        message.textContent = 'Please wait while we securely update your password.';
        try {
          const result = await fetch('/auth/reset-password', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token: resetToken, newPassword }),
          });
          const data = await result.json();
          if (!result.ok) throw new Error(data.message || 'This reset link is invalid or has expired.');
          document.getElementById('reset-content').innerHTML = '<div style="text-align:center"><div aria-hidden="true" style="width:72px;height:72px;margin:0 auto 24px;display:grid;place-items:center;border-radius:50%;background:#e8f6ed;color:#16845b;font-size:36px;font-weight:700">✓</div><p style="margin:0 0 9px;color:#16845b;font-size:12px;font-weight:800;letter-spacing:1.5px;text-transform:uppercase">All set</p><h1 style="margin:0 0 12px;font-size:28px">Password updated</h1><p style="margin:0;color:#65736b;font-size:15px;line-height:1.65">Your password has been changed successfully. You can now sign in to MtongaMart with your new password.</p></div>';
          document.getElementById('footer').textContent = 'You can close this page. Your account is protected with your new password.';
        } catch (error) {
          message.style.color = '#b23d35';
          message.textContent = error.message + ' Request a new reset email if needed.';
          button.disabled = false;
          button.textContent = 'Save new password';
        }
      });
    </script>
  </body>
</html>`);
  }

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Post('resend-verification')
  resendVerification(@Body() dto: ForgotPasswordDto) {
    return this.emailVerificationService.resendVerificationEmail(dto.email);
  }
}
