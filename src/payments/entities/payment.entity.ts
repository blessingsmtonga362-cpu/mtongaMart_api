import {
  Column, CreateDateColumn, Entity, Index, ManyToOne,
  PrimaryGeneratedColumn, UpdateDateColumn,
} from 'typeorm';
import { Users } from '../../user/entities/user.entity';
import { Order } from '../../orders/entities/order.entity';

export enum PaymentStatus {
  PROCESSING = 'PROCESSING',
  PENDING = 'PENDING',
  SUCCESSFUL = 'SUCCESSFUL',
  FAILED = 'FAILED',
  CANCELLED = 'CANCELLED',
}

export enum MobileMoneyOperator {
  AIRTEL = 'airtel',
  TNM = 'tnm',
}

@Entity('order_payments')
@Index(['provider', 'providerChargeId'], { unique: true })
export class Payment {
  @PrimaryGeneratedColumn('uuid') id: string;
  @ManyToOne(() => Order, { nullable: false }) order: Order;
  @ManyToOne(() => Users, { nullable: false }) customer: Users;
  @Column({ type: 'varchar', length: 48, unique: true }) reference: string;
  @Column({ type: 'varchar', length: 32, default: 'paychangu' }) provider: string;
  @Column({ type: 'varchar', length: 12 }) operator: MobileMoneyOperator;
  @Column({ type: 'varchar', length: 100, nullable: true }) providerChargeId: string | null;
  @Column({ type: 'varchar', length: 100, nullable: true }) providerTransactionId: string | null;
  @Column({ type: 'integer' }) amount: number;
  @Column({ type: 'varchar', length: 3, default: 'MWK' }) currency: string;
  @Column({ type: 'enum', enum: PaymentStatus, default: PaymentStatus.PROCESSING }) status: PaymentStatus;
  @Column({ type: 'varchar', length: 500, nullable: true }) failureReason: string | null;
  @Column({ type: 'jsonb', nullable: true, select: false }) providerMetadata: Record<string, unknown> | null;
  @CreateDateColumn() createdAt: Date;
  @UpdateDateColumn() updatedAt: Date;
}
