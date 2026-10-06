import { Entity, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Cart } from './cart.entity';
import { Product } from 'src/products/entities/product.entity';

@Entity()
export class CartItem {
  @PrimaryGeneratedColumn()
  id: number;
  @ManyToOne(() => Cart, (cart) => cart.items)
  cart: Cart;
  @ManyToOne(() => Product, (product) => product.id)
  product: Product;
}
