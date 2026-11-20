import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MailModule } from '../mail/mail.module';
import { Order } from '../orders/entities/order.entity';
import { Payment } from '../payments/entities/payment.entity';
import { Users } from '../user/entities/user.entity';
import { Receipt } from './entities/receipt.entity';
import { ReceiptsController } from './receipts.controller';
import { ReceiptsPdfService } from './receipts-pdf.service';
import { ReceiptsService } from './receipts.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Receipt, Order, Payment, Users]),
    MailModule,
  ],
  controllers: [ReceiptsController],
  providers: [ReceiptsService, ReceiptsPdfService],
  exports: [ReceiptsService],
})
export class ReceiptsModule {}
