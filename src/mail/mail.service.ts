import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);

  constructor(private readonly configService: ConfigService) {}

  async sendMail(
    to: string,
    subject: string,
    html: string,
    attachments?: nodemailer.SendMailOptions['attachments'],
  ) {
    const apiKey = this.configService.getOrThrow<string>('MAILJET_API_KEY');

    const secretKey =
      this.configService.getOrThrow<string>('MAILJET_SECRET_KEY');

    const fromName = this.configService.get<string>(
      'MAIL_FROM_NAME',
      'MtongaMart',
    );

    const fromAddress =
      this.configService.getOrThrow<string>('MAIL_FROM_EMAIL');

    try {
      const normalAttachments: Array<Record<string, string>> = [];
      const inlineAttachments: Array<Record<string, string>> = [];

      for (const attachment of attachments ?? []) {
        let fileBuffer: Buffer;

        if (
          attachment.content &&
          (typeof attachment.content === 'string' ||
            Buffer.isBuffer(attachment.content))
        ) {
          fileBuffer = Buffer.isBuffer(attachment.content)
            ? attachment.content
            : Buffer.from(attachment.content);
        } else if (
          typeof attachment.path === 'string' &&
          /^https?:\/\//i.test(attachment.path)
        ) {
          const fileResponse = await fetch(attachment.path);

          if (!fileResponse.ok) {
            throw new Error(
              `Could not download attachment: ${attachment.filename || 'unknown'}`,
            );
          }

          fileBuffer = Buffer.from(await fileResponse.arrayBuffer());
        } else {
          throw new Error(
            `Unsupported attachment format: ${attachment.filename || 'unknown'}`,
          );
        }

        const mailjetAttachment: Record<string, string> = {
          Filename: attachment.filename || 'attachment',
          ContentType: attachment.contentType || 'application/octet-stream',
          Base64Content: fileBuffer.toString('base64'),
        };

        if (attachment.cid) {
          mailjetAttachment.ContentID = attachment.cid;
          inlineAttachments.push(mailjetAttachment);
        } else {
          normalAttachments.push(mailjetAttachment);
        }
      }

      const credentials = Buffer.from(`${apiKey}:${secretKey}`).toString(
        'base64',
      );

      const response = await fetch('https://api.mailjet.com/v3.1/send', {
        method: 'POST',
        headers: {
          Authorization: `Basic ${credentials}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          Messages: [
            {
              From: {
                Email: fromAddress,
                Name: fromName,
              },
              To: [{ Email: to }],
              Subject: subject,
              HTMLPart: html,
              ...(normalAttachments.length
                ? { Attachments: normalAttachments }
                : {}),
              ...(inlineAttachments.length
                ? { InlinedAttachments: inlineAttachments }
                : {}),
            },
          ],
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(JSON.stringify(result));
      }

      const message = result.Messages?.[0];

      if (message?.Status !== 'success') {
        throw new Error(JSON.stringify(message?.Errors ?? result));
      }

      this.logger.log(`Email successfully submitted to Mailjet for ${to}`);

      return result;
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);

      this.logger.error(`Mailjet email delivery failed for ${to}: ${detail}`);

      throw error;
    }
  }
}
