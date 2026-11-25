import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

@Injectable()
export class MailService implements OnModuleInit {
  private readonly logger = new Logger(MailService.name);
  private transporter: nodemailer.Transporter;

  constructor(private readonly configService: ConfigService) {}

  onModuleInit() {
    const port = this.configService.get<number>('SMTP_PORT', 587);
    const secureSetting = this.configService.get<string>('SMTP_SECURE');
    this.transporter = nodemailer.createTransport({
      host: this.configService.getOrThrow<string>('SMTP_HOST'),
      port,
      secure: secureSetting ? secureSetting.toLowerCase() === 'true' : port === 465,
      auth: {
        user: this.configService.getOrThrow<string>('SMTP_USER'),
        pass: this.configService.getOrThrow<string>('SMTP_PASSWORD'),
      },
      // Fail promptly when the host blocks SMTP egress or the provider is unreachable.
      connectionTimeout: 10_000,
      greetingTimeout: 10_000,
      socketTimeout: 20_000,
    });
  }

  async sendMail(
    to: string,
    subject: string,
    html: string,
    attachments?: nodemailer.SendMailOptions['attachments'],
  ) {
    const fromName = this.configService.get<string>(
      'SMTP_FROM_NAME',
      'MtongaMart',
    );
    const fromAddress =
      this.configService.get<string>('SMTP_FROM_EMAIL') ||
      this.configService.getOrThrow<string>('SMTP_USER');
    try {
      return await this.transporter.sendMail({
        from: { name: fromName, address: fromAddress },
        to,
        subject,
        html,
        attachments,
      });
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      this.logger.error(
        `SMTP delivery failed (host=${this.configService.get<string>('SMTP_HOST')}, port=${this.configService.get<number>('SMTP_PORT', 587)}): ${detail}`,
      );
      throw error;
    }
  }
}
