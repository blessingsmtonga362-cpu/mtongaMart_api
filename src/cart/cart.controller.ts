import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  ParseIntPipe,
} from '@nestjs/common';
import { CartService } from './cart.service';
import { CreateCartDto } from './dto/create-cart.dto';

@Controller('cart')
export class CartController {
  constructor(private readonly cartService: CartService) {}

  @Post(':id')
  async addCart(
    @Param('id', ParseIntPipe) id: number,
    @Body() createCartDto: CreateCartDto,
  ) {
    return this.cartService.addCart(id, createCartDto);
  }

  @Patch(':userId/items/:itemId/quantity')
  async updateCartItemQuantity(
    @Param('userId', ParseIntPipe) userId: number,
    @Param('itemId', ParseIntPipe) itemId: number,
    @Body('delta') delta: number,
  ) {
    return this.cartService.updateCartItemQuantity(userId, itemId, delta);
  }

  @Delete(':userId/items/:itemId')
  async deleteCartItem(
    @Param('userId', ParseIntPipe) userId: number,
    @Param('itemId', ParseIntPipe) itemId: number,
  ) {
    return this.cartService.deleteCartItem(userId, itemId);
  }
  @Get(':id')
  async getCartItems(@Param('id', ParseIntPipe) id: number) {
    return this.cartService.getCartItems(id);
  }
}
