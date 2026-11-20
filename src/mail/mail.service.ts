import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

@Injectable()
export class MailService implements OnModuleInit {
  private transporter: nodemailer.Transporter;

  constructor(private readonly configService: ConfigService) {}

  onModuleInit() {
    this.transporter = nodemailer.createTransport({
      host: this.configService.getOrThrow<string>('SMTP_HOST'),
      port: this.configService.get<number>('SMTP_PORT', 587),
      secure: false,
      auth: {
        user: this.configService.getOrThrow<string>('SMTP_USER'),
        pass: this.configService.getOrThrow<string>('SMTP_PASSWORD'),
      },
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
    return this.transporter.sendMail({
      from: { name: fromName, address: fromAddress },
      to,
      subject,
      html,
      attachments,
    });
  }
}
