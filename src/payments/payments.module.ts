import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Order } from '../orders/entities/order.entity';
import { Cart } from '../cart/entities/cart.entity';
import { CartItem } from '../cart/entities/cartitem.entity';
import { Payment } from './entities/payment.entity';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { PayChanguService } from './paychangu.service';

@Module({
  imports: [ConfigModule, TypeOrmModule.forFeature([Payment, Order, Cart, CartItem])],
  controllers: [PaymentsController],
  providers: [PaymentsService, PayChanguService],
})
export class PaymentsModule {}
