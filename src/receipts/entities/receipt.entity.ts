import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Users } from '../../user/entities/user.entity';
import { Order } from '../../orders/entities/order.entity';
import { Payment } from '../../payments/entities/payment.entity';

export enum ReceiptEmailStatus {
  PENDING = 'PENDING',
  SENDING = 'SENDING',
  SUBMITTED = 'SUBMITTED',
  FAILED = 'FAILED',
}

@Entity('receipts')
@Index(['payment'], { unique: true })
@Index(['receiptNumber'], { unique: true })
@Index(['customer', 'createdAt'])
export class Receipt {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ type: 'varchar', length: 48 }) receiptNumber: string;
  @ManyToOne(() => Order, { nullable: false }) order: Order;
  @ManyToOne(() => Payment, { nullable: false }) payment: Payment;
  @ManyToOne(() => Users, { nullable: false }) customer: Users;
  @Column({ type: 'jsonb' }) snapshot: Record<string, any>;
  @Column({ type: 'varchar', length: 500 }) pdfPath: string;
  @Column({
    type: 'enum',
    enum: ReceiptEmailStatus,
    default: ReceiptEmailStatus.PENDING,
  })
  emailStatus: ReceiptEmailStatus;
  @Column({ type: 'integer', default: 0 }) emailAttempts: number;
  @Column({ type: 'text', nullable: true }) emailError: string | null;
  @Column({ type: 'timestamptz', nullable: true })
  emailSubmittedAt: Date | null;
  @Column({ type: 'timestamptz', nullable: true }) emailStartedAt: Date | null;
  @Column({ type: 'timestamptz', nullable: true })
  emailAttemptedAt: Date | null;
  @CreateDateColumn({ type: 'timestamptz' }) createdAt: Date;
}
