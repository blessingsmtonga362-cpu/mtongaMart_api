import { ConfigService } from '@nestjs/config';
jest.mock('@nestjs/typeorm', () => ({
  InjectRepository: () => () => undefined,
}));
import { DataSource, Repository } from 'typeorm';
import { MailService } from '../mail/mail.service';
import { Receipt } from './entities/receipt.entity';
import { ReceiptsPdfService } from './receipts-pdf.service';
import { ReceiptsService } from './receipts.service';

describe('ReceiptsService API mapping', () => {
  it('returns the field names and nested item values Flutter parses', () => {
    const service = new ReceiptsService(
      {} as DataSource,
      {
        get: (_key: string, fallback: string) => fallback,
      } as unknown as ConfigService,
      {} as ReceiptsPdfService,
      {} as MailService,
      {} as Repository<Receipt>,
    );
    const mapped = (service as any).toApi({
      id: 'receipt-id',
      snapshot: {
        receiptNumber: 'MTM-123',
        orderNumber: 'order-123',
        totalPaid: 12800,
        paymentDate: '2026-11-19T08:00:00.000Z',
        items: [
          { name: 'Tea', quantity: 2, unitPrice: 6400, lineTotal: 12800 },
        ],
      },
      emailStatus: 'SUBMITTED',
      emailAttempts: 1,
      emailSubmittedAt: new Date('2026-11-19T08:01:00.000Z'),
      createdAt: new Date('2026-11-19T08:00:00.000Z'),
    });
    expect(mapped).toMatchObject({
      id: 'receipt-id',
      orderId: 'order-123',
      amountPaid: 12800,
      issuedAt: '2026-11-19T08:00:00.000Z',
      emailStatus: 'SUBMITTED',
      items: [{ productName: 'Tea', totalPrice: 12800, quantity: 2 }],
    });
  });
});
