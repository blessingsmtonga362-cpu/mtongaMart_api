import { Injectable } from '@nestjs/common';
import { CreateCartDto } from './dto/create-cart.dto';
import { UpdateCartDto } from './dto/update-cart.dto';
import { CartItem } from './entities/cartitem.entity';

import { Repository } from 'typeorm';

import { Cart } from './entities/cart.entity';
import { Users } from 'src/user/entities/user.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { Product } from 'src/products/entities/product.entity';

@Injectable()
export class CartService {
  constructor(
    @InjectRepository(Cart)
    private cartRepository: Repository<Cart>,
    @InjectRepository(Users)
    private userRepository: Repository<Users>,
    @InjectRepository(Product)
    private productRepository: Repository<Product>,
    @InjectRepository(CartItem)
    private cartItemRepository: Repository<CartItem>,
  ) {}

  async addCart(id: number, createCartDto: CreateCartDto) {
    let user = await this.cartRepository.findOne({ where: { user: { id } } });
    if (!user) {
      const newCart = this.cartRepository.create({ user: { id } });
      await this.cartRepository.save(newCart);
      return (user = await this.cartRepository.findOne({
        where: { user: { id } },
      }));
    }
    const product = await this.productRepository.findOne({
      where: { id: createCartDto.productId },
    });

    if (!product) {
      throw new Error('Product not found');
    }
    const cartItem = await this.cartItemRepository.findOne({
      where: {
        cart: { user: { id } },
        product: { id: createCartDto.productId },
      },
    });
    if (cartItem) {
      cartItem.quantity += createCartDto.quantity;
      return this.cartItemRepository.save(cartItem);
    }
    const newCartItem = this.cartItemRepository.create({
      quantity: createCartDto.quantity,
      product: product,
      cart: user,
    });
    return this.cartItemRepository.save(newCartItem);
  }

  deleteCartItem(id: number) {
    return this.cartItemRepository.delete(id);
  }
}
