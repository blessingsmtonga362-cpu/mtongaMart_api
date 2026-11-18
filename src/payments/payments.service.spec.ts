import { ConflictException } from '@nestjs/common';
jest.mock('@nestjs/typeorm', () => ({ InjectRepository: () => () => undefined }));
import { DataSource, Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { createHmac } from 'crypto';
import { Order, OrderStatus } from '../orders/entities/order.entity';
import { Payment, PaymentStatus } from './entities/payment.entity';
import { PaymentsService } from './payments.service';
import { PayChanguService } from './paychangu.service';

describe('PaymentsService', () => {
  let service: PaymentsService;
  const orders = { findOne: jest.fn() };
  const payments = { findOne: jest.fn(), save: jest.fn(), create: jest.fn(), delete: jest.fn() };
  const dataSource = {
    getRepository: jest.fn(() => ({ findOne: jest.fn().mockResolvedValue({ id: 'customer', name: 'Test', email: 'test@example.com' }) })),
    transaction: jest.fn(),
  };
  const payChangu = { initialize: jest.fn(), verify: jest.fn(), webhookSecret: jest.fn() };
  const config = { get: jest.fn() };

  beforeEach(async () => {
    jest.clearAllMocks();
    service = new PaymentsService(
      dataSource as unknown as DataSource,
      payChangu as unknown as PayChanguService,
      config as unknown as ConfigService,
      payments as unknown as Repository<Payment>,
      orders as unknown as Repository<Order>,
    );
  });

  it('rejects orders that do not belong to the customer', async () => {
    orders.findOne.mockResolvedValue(null);
    await expect(service.initialize('customer', {
      orderId: 'order', operator: 'airtel', mobile: '0991234567',
    })).rejects.toThrow('Order not found');
  });

  it('prevents a duplicate successful payment', async () => {
    orders.findOne.mockResolvedValue({ id: 'order', totalAmount: 100, status: OrderStatus.PAID });
    await expect(service.initialize('customer', {
      orderId: 'order', operator: 'airtel', mobile: '0991234567',
    })).rejects.toBeInstanceOf(ConflictException);
  });

  it('keeps an accepted initialization pending until verification confirms payment', async () => {
    const order = {
      id: 'order', totalAmount: 100, currency: 'MWK', status: OrderStatus.PENDING_PAYMENT,
    };
    orders.findOne.mockResolvedValue(order);
    payChangu.initialize.mockResolvedValue({ status: 'success', data: { status: 'pending', trans_id: 'tx-1' } });
    payments.save.mockImplementation(async (value) => value);

    const manager = {
      getRepository: (entity: unknown) => entity === Order
        ? { findOne: jest.fn().mockResolvedValue(order) }
        : {
            findOne: jest.fn().mockResolvedValue(null),
            create: jest.fn((value) => ({ id: 'payment', ...value })),
            save: jest.fn().mockImplementation(async (value) => value),
          },
    };
    dataSource.transaction.mockImplementation(async (callback) => callback(manager));

    const result = await service.initialize('customer', {
      orderId: 'order', operator: 'airtel', mobile: '0991234567',
    });

    expect(result.status).toBe(PaymentStatus.PROCESSING);
    expect(payChangu.initialize).toHaveBeenCalledWith(expect.objectContaining({ amount: 100 }));
    expect(payChangu.verify).not.toHaveBeenCalled();
  });

  it('returns a verified successful payment status without changing it again', async () => {
    const payment = {
      id: 'payment', reference: 'MTM-ref', providerChargeId: 'MTM-ref', amount: 100,
      status: PaymentStatus.SUCCESSFUL, order: { id: 'order' },
    };
    payments.findOne.mockResolvedValue(payment);
    const result = await service.getStatus('payment', 'customer');
    expect(result.status).toBe(PaymentStatus.SUCCESSFUL);
    expect(payChangu.verify).not.toHaveBeenCalled();
  });

  it('marks a provider-verified failed transaction as failed', async () => {
    const payment = {
      id: 'payment', reference: 'MTM-ref', providerChargeId: 'MTM-ref', amount: 100,
      status: PaymentStatus.PENDING, order: { id: 'order' },
    };
    payments.findOne.mockResolvedValue(payment);
    payChangu.verify.mockResolvedValue({ data: { status: 'failed' } });
    payments.save.mockImplementation(async (value) => value);

    const result = await service.getStatus('payment', 'customer');
    expect(result.status).toBe(PaymentStatus.FAILED);
  });

  it('rejects a successful provider result with an amount mismatch', async () => {
    const payment = { id: 'payment', providerChargeId: 'charge-1', amount: 100 };
    await expect((service as any).applyVerifiedResult(payment, {
      data: { status: 'success', charge_id: 'charge-1', amount: 99, currency: 'MWK' },
    })).rejects.toThrow('Provider amount does not match order');
  });

  it('rejects a successful provider result with a currency mismatch', async () => {
    const payment = { id: 'payment', providerChargeId: 'charge-1', amount: 100 };
    await expect((service as any).applyVerifiedResult(payment, {
      data: { status: 'success', charge_id: 'charge-1', amount: 100, currency: 'USD' },
    })).rejects.toThrow('Provider currency does not match order');
  });

  it('rejects a webhook with an invalid signature', async () => {
    payChangu.webhookSecret.mockReturnValue('webhook-secret');
    await expect(service.handleWebhook(Buffer.from('{}'), 'invalid'))
      .rejects.toThrow('Invalid webhook signature');
  });

  it('acknowledges duplicate notifications for an already successful payment', async () => {
    const body = Buffer.from(JSON.stringify({ event_type: 'api.charge.payment', charge_id: 'charge-1' }));
    const signature = createHmac('sha256', 'webhook-secret').update(body).digest('hex');
    payChangu.webhookSecret.mockReturnValue('webhook-secret');
    payments.findOne.mockResolvedValue({ status: PaymentStatus.SUCCESSFUL });

    await expect(service.handleWebhook(body, signature)).resolves.toEqual({ received: true });
    expect(payChangu.verify).not.toHaveBeenCalled();
  });
});
