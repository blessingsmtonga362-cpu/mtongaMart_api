import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { CreateCartDto } from './dto/create-cart.dto';
import { Cart } from './entities/cart.entity';
import { CartItem } from './entities/cartitem.entity';
import { Product } from 'src/products/entities/product.entity';

@Injectable()
export class CartService {
  constructor(
    @InjectRepository(Cart)
    private cartRepository: Repository<Cart>,

    @InjectRepository(CartItem)
    private cartItemRepository: Repository<CartItem>,

    @InjectRepository(Product)
    private productRepository: Repository<Product>,
  ) {}

  async addCart(id: number, createCartDto: CreateCartDto) {
    if (
      !Number.isInteger(createCartDto.quantity) ||
      createCartDto.quantity < 1
    ) {
      throw new BadRequestException('Quantity must be a positive integer');
    }

    const product = await this.productRepository.findOne({
      where: {
        id: createCartDto.productId,
      },
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    let cart = await this.cartRepository.findOne({ where: { user: { id } } });

    if (!cart) {
      const newCart = this.cartRepository.create({ user: { id } });
      cart = await this.cartRepository.save(newCart);
    }

    const cartItem = await this.cartItemRepository.findOne({
      where: {
        cart: {
          id: cart.id,
        },
        product: {
          id: createCartDto.productId,
        },
      },
    });

    if (cartItem) {
      cartItem.quantity += createCartDto.quantity;
      return this.cartItemRepository.save(cartItem);
    }

    // 7. Otherwise create a new cart item
    const newCartItem = this.cartItemRepository.create({
      quantity: createCartDto.quantity,
      product: product,
      cart: cart,
    });

    return this.cartItemRepository.save(newCartItem);
  }

  // Increase/decrease cart item quantity
  async updateCartItemQuantity(userId: number, itemId: number, delta: number) {
    if (!Number.isInteger(delta) || delta === 0) {
      throw new BadRequestException(
        'Quantity change must be a non-zero integer',
      );
    }
    const item = await this.cartItemRepository.findOne({
      where: {
        id: itemId,
        cart: {
          user: {
            id: userId,
          },
        },
      },
    });

    if (!item) {
      throw new NotFoundException('Cart item not found');
    }

    const quantity = item.quantity + delta;

    // If quantity becomes 0 or less, remove item
    if (quantity <= 0) {
      await this.cartItemRepository.remove(item);

      return {
        deleted: true,
        itemId,
      };
    }

    item.quantity = quantity;

    return this.cartItemRepository.save(item);
  }

  // Delete one cart item
  async deleteCartItem(userId: number, itemId: number) {
    const item = await this.cartItemRepository.findOne({
      where: {
        id: itemId,
        cart: {
          user: {
            id: userId,
          },
        },
      },
    });

    if (!item) {
      throw new NotFoundException('Cart item not found');
    }

    await this.cartItemRepository.remove(item);

    return {
      deleted: true,
      itemId,
    };
  }

  // Get user's cart
  async getCartItems(id: number) {
    const cart = await this.cartRepository.findOne({
      where: {
        user: {
          id,
        },
      },
      relations: {
        items: {
          product: true,
        },
      },
    });

    return (
      cart ?? {
        id: null,
        user: {
          id,
        },
        items: [],
      }
    );
  }
}
