import { Entity, Column, PrimaryGeneratedColumn, OneToOne } from 'typeorm';
import { Cart } from 'src/cart/entities/cart.entity';

@Entity()
export class Users {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true })
  email: string;

  @Column()
  password: string;

  @OneToOne(() => Cart, (cart) => cart.user)
  cart: Cart;
}
