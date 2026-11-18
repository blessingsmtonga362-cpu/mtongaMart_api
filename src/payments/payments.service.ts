import {
  BadGatewayException, ConflictException, Injectable, Logger, NotFoundException, UnauthorizedException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { createHmac, randomUUID, timingSafeEqual } from 'crypto';
import { DataSource, In, Repository } from 'typeorm';
import { Users } from '../user/entities/user.entity';
import { Cart } from '../cart/entities/cart.entity';
import { CartItem } from '../cart/entities/cartitem.entity';
import { Order, OrderStatus } from '../orders/entities/order.entity';
import { MobileMoneyOperator, Payment, PaymentStatus } from './entities/payment.entity';
import { InitializePaymentDto } from './dto/initialize-payment.dto';
import { PayChanguCharge, PayChanguHttpError, PayChanguService } from './paychangu.service';

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    private readonly dataSource: DataSource,
    private readonly payChangu: PayChanguService,
    private readonly config: ConfigService,
    @InjectRepository(Payment) private readonly payments: Repository<Payment>,
    @InjectRepository(Order) private readonly orders: Repository<Order>,
  ) {}

  async initialize(customerId: string, input: InitializePaymentDto) {
    const order = await this.orders.findOne({ where: { id: input.orderId, customer: { id: customerId } } });
    if (!order) throw new NotFoundException('Order not found');
    if (order.status === OrderStatus.PAID) throw new ConflictException('Order is already paid');
    if (order.totalAmount <= 0 || !Number.isSafeInteger(order.totalAmount)) {
      throw new ConflictException('Order amount is invalid');
    }

    const customer = await this.dataSource.getRepository(Users).findOne({ where: { id: customerId } });
    if (!customer) throw new NotFoundException('Customer not found');
    const reference = `MTM-${randomUUID()}`;
    const payment = await this.dataSource.transaction(async (manager) => {
      const lockedOrder = await manager.getRepository(Order).findOne({
        where: { id: order.id, customer: { id: customerId } },
        lock: { mode: 'pessimistic_write' },
      });
      if (!lockedOrder) throw new NotFoundException('Order not found');
      if (lockedOrder.status === OrderStatus.PAID) throw new ConflictException('Order is already paid');
      const active = await manager.getRepository(Payment).findOne({
        where: { order: { id: order.id }, status: In([PaymentStatus.PROCESSING, PaymentStatus.PENDING]) },
        order: { createdAt: 'DESC' },
      });
      if (active) return active;
      const created = manager.getRepository(Payment).create({
        order: { id: order.id }, customer: { id: customerId },
        reference, provider: 'paychangu', operator: input.operator as MobileMoneyOperator,
        providerChargeId: reference, amount: lockedOrder.totalAmount, currency: lockedOrder.currency,
        status: PaymentStatus.PROCESSING,
      }) as Payment;
      return manager.getRepository(Payment).save(created) as Promise<Payment>;
    }) as Payment;
    if (payment.reference !== reference) return this.toClient(payment);

    const matchesOperator = input.operator === 'airtel'
      ? /^0(?:98|99)\d{7}$/.test(input.mobile)
      : /^0(?:88|89)\d{7}$/.test(input.mobile);
    if (!matchesOperator) {
      await this.payments.delete(payment.id);
      throw new ConflictException('Phone number does not match the selected operator');
    }

    try {
      const response = await this.payChangu.initialize({
        chargeId: reference, mobile: input.mobile, operator: input.operator,
        amount: payment.amount, email: customer.email, name: customer.name,
      });
      const data = response.data ?? {};
      payment.providerTransactionId = data.trans_id?.toString() ?? null;
      payment.providerMetadata = this.safeMetadata(response);
      // A successful initialize response only means PayChangu accepted the request.
      // The customer has not necessarily approved the prompt yet. Only verification
      // may transition a payment to SUCCESSFUL.
      const initializationStatus = this.mapStatus(data.status ?? response.status);
      payment.status = [PaymentStatus.FAILED, PaymentStatus.CANCELLED].includes(initializationStatus)
        ? initializationStatus
        : PaymentStatus.PROCESSING;
      await this.payments.save(payment);
      if (payment.status === PaymentStatus.FAILED || payment.status === PaymentStatus.CANCELLED) {
        throw new ConflictException('The mobile money request was not accepted');
      }
      return this.toClient(payment);
    } catch (error) {
      if (error instanceof ConflictException) throw error;
      if (error instanceof PayChanguHttpError && error.statusCode >= 400 && error.statusCode < 500) {
        payment.status = PaymentStatus.FAILED;
        payment.failureReason = `PayChangu ${error.operation} returned HTTP ${error.statusCode}`;
        await this.payments.save(payment);
        throw new BadGatewayException('PayChangu rejected the payment request. Check the backend provider log.');
      }
      // A timeout or provider 5xx may happen after acceptance. Keep its reference for reconciliation.
      this.logger.warn(`Payment initialization is awaiting reconciliation (${payment.reference})`);
      throw new ServiceUnavailableException('Payment status is being confirmed. Check again shortly.');
    }
  }

  async getStatus(paymentId: string, customerId: string) {
    const payment = await this.payments.findOne({
      where: { id: paymentId, customer: { id: customerId } },
      relations: { order: true },
    });
    if (!payment) throw new NotFoundException('Payment not found');
    if ([PaymentStatus.PENDING, PaymentStatus.PROCESSING].includes(payment.status)) {
      try {
        const result = await this.payChangu.verify(payment.providerChargeId ?? payment.reference);
        await this.applyVerifiedResult(payment, result);
      } catch (error) {
        const definitiveMismatch = error instanceof ConflictException;
        if (definitiveMismatch) {
          payment.status = PaymentStatus.FAILED;
          payment.failureReason = 'Verified provider details did not match the order';
          await this.payments.save(payment);
        } else {
          // Verification may briefly return 404 while a newly accepted charge is
          // propagating. Keep the payment reconcilable; a provider HTTP error is
          // not proof that the customer failed to pay.
          const providerStatus = error instanceof PayChanguHttpError
            ? ` (PayChangu HTTP ${error.statusCode})`
            : '';
          this.logger.debug(`Payment ${payment.reference} remains awaiting provider verification${providerStatus}`);
        }
      }
    }
    return this.toClient(payment);
  }

  async getOrderPaymentStatus(orderId: string, customerId: string) {
    const order = await this.orders.findOne({ where: { id: orderId, customer: { id: customerId } } });
    if (!order) throw new NotFoundException('Order not found');
    const payment = await this.payments.findOne({
      where: { order: { id: orderId }, customer: { id: customerId } },
      order: { createdAt: 'DESC' },
    });
    if (!payment) throw new NotFoundException('Payment attempt not found');
    return this.getStatus(payment.id, customerId);
  }

  async handleWebhook(rawBody: Buffer, signature: string | undefined) {
    const secret = this.payChangu.webhookSecret();
    if (!secret) throw new ServiceUnavailableException('Webhook verification is not configured');
    if (!signature || !this.validSignature(rawBody, signature, secret)) {
      throw new UnauthorizedException('Invalid webhook signature');
    }
    let event: Record<string, any>;
    try { event = JSON.parse(rawBody.toString('utf8')); }
    catch { throw new UnauthorizedException('Invalid webhook payload'); }

    const chargeId = event.charge_id?.toString();
    if (!chargeId || event.event_type !== 'api.charge.payment') {
      this.logger.debug('Ignoring unrecognized PayChangu webhook event');
      return { received: true };
    }
    const payment = await this.payments.findOne({
      where: { providerChargeId: chargeId, provider: 'paychangu' },
      relations: { order: true },
    });
    if (!payment) {
      this.logger.warn('PayChangu webhook has an unknown charge reference');
      return { received: true };
    }
    if (payment.status === PaymentStatus.SUCCESSFUL) return { received: true };

    // PayChangu explicitly recommends re-querying direct-charge transactions.
    const verified = await this.payChangu.verify(chargeId);
    await this.applyVerifiedResult(payment, verified);
    return { received: true };
  }

  private validSignature(rawBody: Buffer, signature: string, secret: string): boolean {
    const digest = createHmac('sha256', secret).update(rawBody).digest();
    const supplied = Buffer.from(signature.trim(), 'hex');
    return supplied.length === digest.length && timingSafeEqual(digest, supplied);
  }

  private async applyVerifiedResult(payment: Payment, response: PayChanguCharge) {
    const data = response.data?.transaction ?? response.data ?? {};
    const status = this.mapStatus(data.status ?? response.status);
    if (status === PaymentStatus.SUCCESSFUL) {
      const chargeId = data.charge_id?.toString();
      const amount = Number(data.amount);
      const currency = String(data.currency ?? '').toUpperCase();
      const ref = (data.charge_id ?? data.chargeId)?.toString();
      // PayChangu currently shows MWK and MK in separate Direct Charge examples.
      // MK is accepted as the provider's documented alias for Malawi Kwacha.
      if (chargeId !== payment.providerChargeId || ref && ref !== payment.providerChargeId) {
        throw new ConflictException('Provider reference does not match');
      }
      if (!Number.isSafeInteger(amount) || amount !== payment.amount) {
        throw new ConflictException('Provider amount does not match order');
      }
      if (!['MWK', 'MK'].includes(currency)) {
        throw new ConflictException('Provider currency does not match order');
      }
      await this.dataSource.transaction(async (manager) => {
        const locked = await manager.getRepository(Payment).findOne({
          where: { id: payment.id }, relations: { order: true, customer: true }, lock: { mode: 'pessimistic_write' },
        });
        if (!locked || locked.status === PaymentStatus.SUCCESSFUL) return;
        const orderRow = await manager.getRepository(Order).findOne({
          where: { id: locked.order.id }, lock: { mode: 'pessimistic_write' },
        });
        const order = orderRow && await manager.getRepository(Order).findOne({
          where: { id: orderRow.id }, relations: { items: true },
        });
        if (!order || order.totalAmount !== amount || order.currency !== 'MWK') {
          throw new ConflictException('Verified payment does not match order');
        }
        locked.status = PaymentStatus.SUCCESSFUL;
        locked.providerTransactionId = data.trans_id?.toString() ?? locked.providerTransactionId;
        locked.providerMetadata = this.safeMetadata(response);
        await manager.getRepository(Payment).save(locked);
        if (order.status !== OrderStatus.PAID) {
          order.status = OrderStatus.PAID;
          await manager.getRepository(Order).save(order);
        }
        const cartRow = await manager.getRepository(Cart).findOne({
          where: { user: { id: locked.customer.id } }, lock: { mode: 'pessimistic_write' },
        });
        const cart = cartRow && await manager.getRepository(Cart).findOne({
          where: { id: cartRow.id }, relations: { items: { product: true } },
        });
        if (cart && cart.items.length === order.items.length && cart.items.every((item) =>
          order.items.some((ordered) => ordered.productId === item.product.id && ordered.quantity === item.quantity),
        )) {
          for (const item of cart.items) {
            await manager.getRepository(CartItem).delete({ id: item.id, quantity: item.quantity });
          }
        }
        payment.status = locked.status;
      });
      return;
    }
    if ([PaymentStatus.FAILED, PaymentStatus.CANCELLED].includes(status)) {
      payment.status = status;
      payment.failureReason = 'Provider reported an unsuccessful transaction';
    } else if (status === PaymentStatus.PENDING) {
      payment.status = PaymentStatus.PENDING;
    }
    payment.providerTransactionId = data.trans_id?.toString() ?? payment.providerTransactionId;
    payment.providerMetadata = this.safeMetadata(response);
    await this.payments.save(payment);
  }

  private mapStatus(status: unknown): PaymentStatus {
    const value = String(status ?? '').toLowerCase();
    if (value === 'success' || value === 'successful' || value === 'completed') return PaymentStatus.SUCCESSFUL;
    if (value === 'failed' || value === 'failure' || value === 'error' || value === 'rejected' || value === 'declined') return PaymentStatus.FAILED;
    if (value === 'cancelled' || value === 'canceled') return PaymentStatus.CANCELLED;
    return PaymentStatus.PENDING;
  }

  private safeMetadata(response: PayChanguCharge): Record<string, unknown> {
    // Avoid persisting customer PII, authorization payloads, and provider error details.
    const data = response.data ?? {};
    return {
      status: response.status ?? data.status ?? null,
      charge_id: data.charge_id ?? null,
      trans_id: data.trans_id ?? null,
      amount: data.amount ?? null,
      currency: data.currency ?? null,
      mode: data.mode ?? null,
    };
  }

  private toClient(payment: Payment) {
    return { id: payment.id, orderId: payment.order?.id, reference: payment.reference, status: payment.status };
  }
}
