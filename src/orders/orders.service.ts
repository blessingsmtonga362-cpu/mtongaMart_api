import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Cart } from '../cart/entities/cart.entity';
import { Order, OrderItem, OrderStatus } from './entities/order.entity';

@Injectable()
export class OrdersService {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(Order) private readonly orders: Repository<Order>,
  ) {}

  async create(customerId: string, deliveryMethod: 'shop' | 'courier') {
    return this.dataSource.transaction(async (manager) => {
      const cartRow = await manager.getRepository(Cart).findOne({
        where: { user: { id: customerId } },
        lock: { mode: 'pessimistic_write' },
      });
      const cart = cartRow && await manager.getRepository(Cart).findOne({
        where: { id: cartRow.id }, relations: { items: { product: true } },
      });
      if (!cart?.items?.length) throw new BadRequestException('Cart is empty');
      const subtotal = cart.items.reduce((sum, item) => {
        const price = Number(item.product.price);
        if (!Number.isSafeInteger(price) || price < 0 || !Number.isInteger(item.quantity) || item.quantity < 1) {
          throw new BadRequestException('Cart contains an invalid item');
        }
        return sum + price * item.quantity;
      }, 0);
      if (!Number.isSafeInteger(subtotal)) throw new BadRequestException('Order total is invalid');
      const deliveryAmount = deliveryMethod === 'courier' ? 2000 : 0;
      const existingOrders = await manager.getRepository(Order).find({
        where: { customer: { id: customerId }, status: OrderStatus.PENDING_PAYMENT },
        relations: { items: true },
        order: { createdAt: 'DESC' },
        take: 10,
      });
      const matchingOrder = existingOrders.find((existing) =>
        existing.deliveryMethod === deliveryMethod && existing.subtotal === subtotal &&
        existing.items.length === cart.items.length && existing.items.every((ordered) =>
          cart.items.some((item) => item.product.id === ordered.productId &&
            item.quantity === ordered.quantity && Number(item.product.price) === ordered.unitPrice),
        ),
      );
      if (matchingOrder) return matchingOrder;
      const order = manager.getRepository(Order).create({
        customer: { id: customerId }, deliveryMethod, subtotal, deliveryAmount,
        totalAmount: subtotal + deliveryAmount, currency: 'MWK', status: OrderStatus.PENDING_PAYMENT,
        items: cart.items.map((item) => manager.getRepository(OrderItem).create({
          productId: item.product.id, productName: item.product.name,
          unitPrice: Number(item.product.price), quantity: item.quantity,
          lineTotal: Number(item.product.price) * item.quantity,
        })),
      });
      const saved = await manager.getRepository(Order).save(order);
      return saved;
    });
  }

  async getOwned(id: string, customerId: string) {
    const order = await this.orders.findOne({ where: { id, customer: { id: customerId } }, relations: { items: true } });
    if (!order) throw new NotFoundException('Order not found');
    return order;
  }
}
