import {
  Column,
  CreateDateColumn,
  Entity,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Users } from '../../user/entities/user.entity';

export enum OrderStatus {
  PENDING_PAYMENT = 'PENDING_PAYMENT',
  PAID = 'PAID',
  CANCELLED = 'CANCELLED',
}

@Entity('orders')
export class Order {
  @PrimaryGeneratedColumn('uuid') id: string;
  @ManyToOne(() => Users, { nullable: false }) customer: Users;
  @Column({ type: 'varchar', length: 16 }) deliveryMethod: 'shop' | 'courier';
  @Column({ type: 'integer' }) subtotal: number;
  @Column({ type: 'integer' }) deliveryAmount: number;
  @Column({ type: 'integer' }) totalAmount: number;
  @Column({ type: 'varchar', length: 3, default: 'MWK' }) currency: string;
  @Column({ type: 'enum', enum: OrderStatus, default: OrderStatus.PENDING_PAYMENT }) status: OrderStatus;
  @OneToMany(() => OrderItem, (item) => item.order, { cascade: true }) items: OrderItem[];
  @CreateDateColumn() createdAt: Date;
  @UpdateDateColumn() updatedAt: Date;
}

@Entity('order_items')
export class OrderItem {
  @PrimaryGeneratedColumn('uuid') id: string;
  @ManyToOne(() => Order, (order) => order.items, { onDelete: 'CASCADE' }) order: Order;
  @Column({ type: 'integer' }) productId: number;
  @Column({ type: 'varchar', length: 255 }) productName: string;
  @Column({ type: 'integer' }) unitPrice: number;
  @Column({ type: 'integer' }) quantity: number;
  @Column({ type: 'integer' }) lineTotal: number;
}
