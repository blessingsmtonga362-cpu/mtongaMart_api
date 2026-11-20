import {
  Injectable,
  Logger,
  HttpException,
  HttpStatus,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { randomUUID } from 'crypto';
import { resolve } from 'path';
import { DataSource, Repository } from 'typeorm';
import { MailService } from '../mail/mail.service';
import { Payment, PaymentStatus } from '../payments/entities/payment.entity';
import { Receipt, ReceiptEmailStatus } from './entities/receipt.entity';
import { ReceiptsPdfService } from './receipts-pdf.service';

@Injectable()
export class ReceiptsService {
  private readonly logger = new Logger(ReceiptsService.name);
  private readonly storageRoot: string;
  constructor(
    private readonly db: DataSource,
    private readonly config: ConfigService,
    private readonly pdf: ReceiptsPdfService,
    private readonly mail: MailService,
    @InjectRepository(Receipt) private readonly receipts: Repository<Receipt>,
  ) {
    this.storageRoot = resolve(
      config.get<string>('RECEIPT_STORAGE_DIR', 'storage/receipts'),
    );
  }

  async createForSuccessfulPayment(paymentId: string): Promise<void> {
    const payment = await this.db.getRepository(Payment).findOne({
      where: { id: paymentId, status: PaymentStatus.SUCCESSFUL },
      relations: { order: { items: true }, customer: true },
    });
    if (!payment) return;
    let receipt = await this.receipts.findOne({
      where: { payment: { id: paymentId } },
    });
    if (!receipt) {
      const snapshot = {
        // Payment references already carry the MTM- prefix.
        receiptNumber: payment.reference,
        orderNumber: payment.order.id,
        orderId: payment.order.id,
        deliveryMethod: payment.order.deliveryMethod,
        customerName: payment.customer.name,
        customerEmail: payment.customer.email,
        paymentReference: payment.providerTransactionId || payment.reference,
        paymentMethod: payment.operator.toUpperCase(),
        paymentDate: payment.updatedAt.toISOString(),
        currency: payment.currency,
        items: payment.order.items.map((item) => ({
          name: item.productName,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          lineTotal: item.lineTotal,
        })),
        subtotal: payment.order.subtotal,
        deliveryFee: payment.order.deliveryAmount,
        totalPaid: payment.amount,
        status: 'PAID',
      };
      const filePath = resolve(this.storageRoot, `${randomUUID()}.pdf`);
      try {
        receipt = await this.db.transaction(async (manager) => {
          const repository = manager.getRepository(Receipt);
          const existing = await repository.findOne({
            where: { payment: { id: paymentId } },
          });
          if (existing) return existing;
          return repository.save(
            repository.create({
              receiptNumber: snapshot.receiptNumber,
              order: { id: payment.order.id },
              payment: { id: payment.id },
              customer: { id: payment.customer.id },
              snapshot,
              pdfPath: filePath,
              emailStatus: ReceiptEmailStatus.PENDING,
            }),
          );
        });
      } catch (error) {
        // A webhook and a status poll can race after payment success. The unique
        // payment constraint makes one insert win; reuse that receipt here.
        if (!this.isUniqueViolation(error)) throw error;
        receipt = await this.receipts.findOne({
          where: { payment: { id: paymentId } },
        });
        if (!receipt) throw error;
      }
    }
    await this.pdf.create(receipt.pdfPath, receipt.snapshot);
    if (
      receipt.emailStatus === ReceiptEmailStatus.PENDING ||
      this.stale(receipt)
    )
      await this.deliver(receipt.id);
  }

  async list(customerId: string) {
    const rows = await this.receipts.find({
      where: { customer: { id: customerId } },
      order: { createdAt: 'DESC' },
    });
    return rows.map((receipt) => this.toApi(receipt));
  }

  async get(id: string, customerId: string) {
    return this.toApi(await this.owned(id, customerId));
  }

  async download(id: string, customerId: string) {
    const receipt = await this.owned(id, customerId);
    try {
      return { receipt, bytes: await this.pdf.read(receipt.pdfPath) };
    } catch {
      throw new ServiceUnavailableException('Receipt PDF is unavailable');
    }
  }

  async resend(id: string, customerId: string) {
    await this.db.transaction(async (manager) => {
      const locked = await manager.getRepository(Receipt).findOne({
        where: { id, customer: { id: customerId } },
        lock: { mode: 'pessimistic_write' },
      });
      if (!locked) throw new NotFoundException('Receipt not found');
      if (
        locked.emailAttemptedAt &&
        Date.now() - locked.emailAttemptedAt.getTime() < 60_000
      ) {
        throw new HttpException(
          'Please wait before requesting another receipt email.',
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }
      if (
        locked.emailStatus !== ReceiptEmailStatus.SENDING ||
        this.stale(locked)
      ) {
        locked.emailStatus = ReceiptEmailStatus.PENDING;
        locked.emailError = null;
        await manager.getRepository(Receipt).save(locked);
      }
    });
    await this.deliver(id);
    return this.toApi(await this.owned(id, customerId));
  }

  private async deliver(id: string): Promise<void> {
    const claimed = await this.db.transaction(async (manager) => {
      const repo = manager.getRepository(Receipt);
      const row = await repo.findOne({
        where: { id },
        relations: { customer: true },
        lock: { mode: 'pessimistic_write' },
      });
      if (
        !row ||
        row.emailStatus === ReceiptEmailStatus.SUBMITTED ||
        (row.emailStatus === ReceiptEmailStatus.SENDING && !this.stale(row))
      )
        return null;
      row.emailStatus = ReceiptEmailStatus.SENDING;
      row.emailStartedAt = new Date();
      row.emailAttemptedAt = new Date();
      row.emailAttempts += 1;
      await repo.save(row);
      return row;
    });
    if (!claimed) return;
    try {
      const bytes = await this.pdf.read(claimed.pdfPath);
      await this.mail.sendMail(
        claimed.snapshot.customerEmail,
        `MtongaMart receipt ${claimed.receiptNumber}`,
        this.receiptEmailHtml(claimed.snapshot),
        [
          {
            filename: `${claimed.receiptNumber}.pdf`,
            content: bytes,
            contentType: 'application/pdf',
          },
        ],
      );
      await this.receipts.update(id, {
        emailStatus: ReceiptEmailStatus.SUBMITTED,
        emailError: null,
        emailSubmittedAt: new Date(),
        emailStartedAt: null,
      });
    } catch {
      this.logger.warn(
        `Receipt email delivery failed for ${claimed.receiptNumber}`,
      );
      await this.receipts.update(id, {
        emailStatus: ReceiptEmailStatus.FAILED,
        emailError: 'Delivery failed',
        emailStartedAt: null,
      });
    }
  }

  private async owned(id: string, customerId: string): Promise<Receipt> {
    const receipt = await this.receipts.findOne({
      where: { id, customer: { id: customerId } },
    });
    if (!receipt) throw new NotFoundException('Receipt not found');
    return receipt;
  }
  private toApi(receipt: Receipt) {
    const snapshot = receipt.snapshot;
    return {
      id: receipt.id,
      ...snapshot,
      orderId: snapshot.orderId ?? snapshot.orderNumber,
      amountPaid: snapshot.amountPaid ?? snapshot.totalPaid,
      issuedAt: snapshot.issuedAt ?? snapshot.paymentDate,
      items: (snapshot.items ?? []).map((item: Record<string, any>) => ({
        ...item,
        productName: item.productName ?? item.name,
        totalPrice: item.totalPrice ?? item.lineTotal,
      })),
      emailStatus: receipt.emailStatus,
      emailAttempts: receipt.emailAttempts,
      emailSubmittedAt: receipt.emailSubmittedAt,
      createdAt: receipt.createdAt,
    };
  }
  private stale(receipt: Receipt) {
    return (
      receipt.emailStatus === ReceiptEmailStatus.SENDING &&
      (!receipt.emailStartedAt ||
        Date.now() - receipt.emailStartedAt.getTime() > 10 * 60 * 1000)
    );
  }
  private receiptEmailHtml(snapshot: Record<string, any>): string {
    const currency = this.html(snapshot.currency);
    const money = (value: unknown) => `${currency} ${this.html(value)}`;
    const items = Array.isArray(snapshot.items) ? snapshot.items : [];
    const itemRows = items.length
      ? items
          .map(
            (item: Record<string, any>) =>
              `<tr><td style="padding:10px 0;border-bottom:1px solid #e5ebe7;color:#102b4e">${this.html(item.name)}<br><span style="color:#64758a;font-size:13px">Qty ${this.html(item.quantity)}</span></td><td align="right" style="padding:10px 0;border-bottom:1px solid #e5ebe7;color:#102b4e;white-space:nowrap">${money(item.lineTotal)}</td></tr>`,
          )
          .join('')
      : '<tr><td colspan="2" style="padding:12px 0;color:#64758a">Item details are unavailable.</td></tr>';

    return `<!doctype html>
<html lang="en">
  <body style="margin:0;padding:24px 12px;background:#f2f5f2;font-family:Arial,Helvetica,sans-serif;color:#102b4e">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:620px;margin:0 auto">
      <tr><td align="center" style="padding:12px 0 20px">
        <div style="margin:0 0 8px;color:#07845a;font-size:12px;font-weight:bold;letter-spacing:1.2px;text-transform:uppercase">Payment confirmation</div>
        <h1 style="margin:0 0 6px;color:#102b4e;font-size:25px">Payment successful</h1>
        <div style="font-size:30px;font-weight:bold;color:#102b4e">${money(snapshot.totalPaid)}</div>
        <div style="margin-top:8px;color:#64758a">${this.html(snapshot.paymentDate)}</div>
      </td></tr>
      <tr><td style="padding:24px;background:#fff;border-radius:20px">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
          <tr><td style="padding-bottom:18px;border-bottom:1px solid #e4eae7">
            <div style="font-size:23px;font-weight:bold"><span style="color:#102b4e">Mtonga</span><span style="color:#07845a">Mart</span></div>
            <div style="margin-top:4px;color:#64758a;font-style:italic">Shop Smart. Live Better.</div>
          </td><td align="right" style="padding-bottom:18px;border-bottom:1px solid #e4eae7;color:#102b4e;font-weight:bold;letter-spacing:1px">RECEIPT</td></tr>
          <tr><td colspan="2" style="padding-top:16px">
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
              <tr><th align="left" style="padding-bottom:8px;color:#64758a;font-size:12px">ITEM</th><th align="right" style="padding-bottom:8px;color:#64758a;font-size:12px">AMOUNT</th></tr>
              ${itemRows}
            </table>
          </td></tr>
          <tr><td style="padding-top:16px;color:#64758a">Subtotal</td><td align="right" style="padding-top:16px">${money(snapshot.subtotal)}</td></tr>
          <tr><td style="padding-top:8px;padding-bottom:14px;color:#64758a">Delivery fee</td><td align="right" style="padding-top:8px;padding-bottom:14px">${money(snapshot.deliveryFee)}</td></tr>
          <tr><td style="padding:14px 0;border-top:2px solid #102b4e;font-size:17px;font-weight:bold">Total paid</td><td align="right" style="padding:14px 0;border-top:2px solid #102b4e;font-size:19px;font-weight:bold">${money(snapshot.totalPaid)}</td></tr>
          <tr><td colspan="2" style="padding-top:16px;border-top:1px dashed #cbd8cf">
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
              <tr><td style="padding:6px 0;color:#64758a">Receipt no.</td><td align="right" style="padding:6px 0">${this.html(snapshot.receiptNumber)}</td></tr>
              <tr><td style="padding:6px 0;color:#64758a">Order no.</td><td align="right" style="padding:6px 0">${this.html(snapshot.orderNumber)}</td></tr>
              <tr><td style="padding:6px 0;color:#64758a">Payment ref.</td><td align="right" style="padding:6px 0">${this.html(snapshot.paymentReference)}</td></tr>
              <tr><td style="padding:6px 0;color:#64758a">Status</td><td align="right" style="padding:6px 0;color:#07845a;font-weight:bold">Paid in full</td></tr>
            </table>
          </td></tr>
        </table>
      </td></tr>
      <tr><td align="center" style="padding:24px 8px 4px;font-weight:bold">Thank you for shopping with MtongaMart</td></tr>
      <tr><td align="center" style="padding:6px 8px 12px;color:#64758a;font-size:13px">Need help? 265889949534</td></tr>
    </table>
  </body>
</html>`;
  }

  private html(value: unknown) {
    return String(value ?? '').replace(
      /[&<>"']/g,
      (char) =>
        ({
          '&': '&amp;',
          '<': '&lt;',
          '>': '&gt;',
          '"': '&quot;',
          "'": '&#39;',
        })[char],
    );
  }

  private isUniqueViolation(error: unknown): boolean {
    return (
      typeof error === 'object' &&
      error !== null &&
      'driverError' in error &&
      typeof error.driverError === 'object' &&
      error.driverError !== null &&
      'code' in error.driverError &&
      error.driverError.code === '23505'
    );
  }
}
