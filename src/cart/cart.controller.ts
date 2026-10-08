import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
} from '@nestjs/common';
import { CartService } from './cart.service';
import { CreateCartDto } from './dto/create-cart.dto';

@Controller('cart')
export class CartController {
  constructor(private readonly cartService: CartService) {}

  @Post(':id')
  async addCart(@Param('id') id: number, @Body() createCartDto: CreateCartDto) {
    return this.cartService.addCart(id, createCartDto);
  }

  @Get(':id')
  async getCartItems(@Param('id') id: number) {
    return await this.cartService.getCartItems(id);
  }
}
