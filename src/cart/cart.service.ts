import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CreateCartDto } from './dto/create-cart.dto';
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
    if (!Number.isInteger(createCartDto.quantity) || createCartDto.quantity < 1) {
      throw new BadRequestException('Quantity must be a positive integer');
    }
    const product = await this.productRepository.findOne({
      where: { id: createCartDto.productId },
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }
    let cart = await this.cartRepository.findOne({ where: { user: { id } } });
    if (!cart) {
      cart = await this.cartRepository.save(
        this.cartRepository.create({ user: { id } }),
      );
    }
    const cartItem = await this.cartItemRepository.findOne({
      where: {
        cart: { id: cart.id },
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
      cart,
    });
    return this.cartItemRepository.save(newCartItem);
  }

  async updateCartItemQuantity(userId: number, itemId: number, delta: number) {
    if (!Number.isInteger(delta) || delta === 0) {
      throw new BadRequestException('Quantity change must be a non-zero integer');
    }
    const item = await this.cartItemRepository.findOne({
      where: { id: itemId, cart: { user: { id: userId } } },
    });
    if (!item) throw new NotFoundException('Cart item not found');

    const quantity = item.quantity + delta;
    if (quantity <= 0) {
      await this.cartItemRepository.remove(item);
      return { deleted: true, itemId };
    }
    item.quantity = quantity;
    return this.cartItemRepository.save(item);
  }

  async deleteCartItem(userId: number, itemId: number) {
    const item = await this.cartItemRepository.findOne({
      where: { id: itemId, cart: { user: { id: userId } } },
    });
    if (!item) throw new NotFoundException('Cart item not found');
    await this.cartItemRepository.remove(item);
    return { deleted: true, itemId };
  }
  async getCartItems(id: number) {
    return this.cartRepository.findOne({
      where: { user: { id } },
      relations: { items: { product: true } },
    }).then((cart) => cart ?? { id: null, user: { id }, items: [] });
  }
}
