import { Injectable } from '@nestjs/common';
import { mkdir, readFile, writeFile } from 'fs/promises';
import { dirname, resolve } from 'path';

// A small, dependency-free PDF writer keeps receipt generation portable. Text uses
// the built-in Helvetica font and is escaped for PDF literal strings.
@Injectable()
export class ReceiptsPdfService {
  async create(filePath: string, receipt: Record<string, any>): Promise<void> {
    const lines = [
      'MTONGAMART',
      'PAYMENT RECEIPT',
      '',
      `Receipt: ${receipt.receiptNumber}`,
      `Order: ${receipt.orderNumber}`,
      `Customer: ${receipt.customerName}`,
      `Email: ${receipt.customerEmail}`,
      `Payment reference: ${receipt.paymentReference}`,
      `Payment method: ${receipt.paymentMethod}`,
      `Payment date: ${receipt.paymentDate}`,
      '',
      'ITEMS',
      ...receipt.items.map(
        (item: any) =>
          `${item.name}  x${item.quantity}  ${item.lineTotal} ${receipt.currency}`,
      ),
      '',
      `Subtotal: ${receipt.subtotal} ${receipt.currency}`,
      `Delivery: ${receipt.deliveryFee} ${receipt.currency}`,
      `TOTAL PAID: ${receipt.totalPaid} ${receipt.currency}`,
      'STATUS: PAID',
    ];
    const commands = [
      '0.05 0.18 0.30 rg',
      '0 810 612 32 re f',
      '0.34 0.78 0.62 rg',
      '0 806 612 4 re f',
      '0.05 0.18 0.30 rg',
      'BT',
      '/F1 20 Tf',
      '50 790 Td',
      `(${this.escape(lines[0])}) Tj`,
      '/F1 10 Tf',
    ];
    for (const line of lines.slice(1))
      commands.push('0 -20 Td', `(${this.escape(line)}) Tj`);
    commands.push('ET');
    const stream = commands.join('\n');
    const objects = [
      '<< /Type /Catalog /Pages 2 0 R >>',
      '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
      '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
      '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
      `<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`,
    ];
    let pdf = '%PDF-1.4\n';
    const offsets = [0];
    objects.forEach((object, index) => {
      offsets.push(Buffer.byteLength(pdf));
      pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
    });
    const xref = Buffer.byteLength(pdf);
    pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
    offsets.slice(1).forEach((offset) => {
      pdf += `${String(offset).padStart(10, '0')} 00000 n \n`;
    });
    pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
    const target = resolve(filePath);
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, pdf, 'binary');
  }

  async read(filePath: string): Promise<Buffer> {
    return readFile(resolve(filePath));
  }
  private escape(value: unknown): string {
    return String(value ?? '')
      .normalize('NFKD')
      .replace(/[^\x20-\x7E]/g, '?')
      .replace(/[()\\]/g, '\\$&')
      .slice(0, 110);
  }
}
