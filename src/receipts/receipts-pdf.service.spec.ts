import { mkdtemp, readFile, rm } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { ReceiptsPdfService } from './receipts-pdf.service';

describe('ReceiptsPdfService', () => {
  it('writes a readable PDF containing the receipt snapshot', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'mtongamart-receipt-'));
    const file = join(directory, 'receipt.pdf');
    try {
      await new ReceiptsPdfService().create(file, {
        receiptNumber: 'MTM-test',
        orderNumber: 'order-1',
        customerName: 'Test Buyer',
        customerEmail: 'buyer@example.com',
        paymentReference: 'tx-1',
        paymentMethod: 'AIRTEL',
        paymentDate: '2026-11-19',
        currency: 'MWK',
        items: [{ name: 'Tea', quantity: 2, lineTotal: 1000 }],
        subtotal: 1000,
        deliveryFee: 0,
        totalPaid: 1000,
      });
      const bytes = await readFile(file);
      expect(bytes.subarray(0, 8).toString()).toBe('%PDF-1.4');
      expect(bytes.toString()).toContain('xref');
      expect(bytes.toString()).toContain('%%EOF');
      expect(bytes.toString()).toContain('MTM-test');
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
});
