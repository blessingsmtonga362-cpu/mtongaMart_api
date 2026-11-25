import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';
import * as nodemailer from 'nodemailer';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly resend: Resend;

  constructor(private readonly configService: ConfigService) {
    this.resend = new Resend(
      this.configService.getOrThrow<string>('RESEND_API_KEY'),
    );
  }

  async sendMail(
    to: string,
    subject: string,
    html: string,
    attachments?: nodemailer.SendMailOptions['attachments'],
  ) {
    const fromName = this.configService.get<string>(
      'MAIL_FROM_NAME',
      'MtongaMart',
    );

    const fromAddress = this.configService.getOrThrow<string>('MAIL_FROM');

    try {
      // Convert common Nodemailer attachment formats
      // into Resend attachment formats.
      const resendAttachments = attachments?.map((attachment) => {
        if (
          attachment.content &&
          (typeof attachment.content === 'string' ||
            Buffer.isBuffer(attachment.content))
        ) {
          return {
            filename: attachment.filename || 'attachment',
            content: attachment.content,
            contentType: attachment.contentType,
            contentId: attachment.cid,
          };
        }

        if (attachment.path && /^https?:\/\//i.test(attachment.path)) {
          return {
            filename: attachment.filename || 'attachment',
            path: attachment.path,
            contentType: attachment.contentType,
            contentId: attachment.cid,
          };
        }

        throw new Error(
          `Unsupported attachment format: ${attachment.filename || 'unknown'}`,
        );
      });

      const { data, error } = await this.resend.emails.send({
        from: `${fromName} <${fromAddress}>`,
        to: [to],
        subject,
        html,
        ...(resendAttachments?.length
          ? { attachments: resendAttachments }
          : {}),
      });

      if (error) {
        throw new Error(error.message);
      }

      this.logger.log(`Email successfully submitted to Resend for ${to}`);

      return data;
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);

      this.logger.error(`Resend email delivery failed for ${to}: ${detail}`);

      throw error;
    }
  }
}
