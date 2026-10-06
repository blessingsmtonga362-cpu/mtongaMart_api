import { CartItem } from 'src/cart/entities/cartitem.entity';
import { Catergory } from 'src/catergory/entities/catergory.entity';
import {
  Column,
  Entity,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity()
export class Product {
  @PrimaryGeneratedColumn()
  id: number;
  @Column()
  name: string;
  @Column()
  price: number;
  @Column()
  image: string;
  @Column()
  review: number;
  @Column()
  rate: number;
  @ManyToOne(() => Catergory)
  catergory: Catergory;
  @OneToMany(() => CartItem, (cartItem) => cartItem.product)
  cartItems: CartItem[];
}
