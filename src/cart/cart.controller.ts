import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  ParseIntPipe,
  UseGuards,
} from '@nestjs/common';
import { CartService } from './cart.service';
import { CreateCartDto } from './dto/create-cart.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';

@UseGuards(JwtAuthGuard)
@Controller('cart')
export class CartController {
  constructor(private readonly cartService: CartService) {}

  @Post()
  async addCart(
    @CurrentUser() user: AuthenticatedUser,
    @Body() createCartDto: CreateCartDto,
  ) {
    return this.cartService.addCart(user.sub, createCartDto);
  }

  @Patch('items/:itemId/quantity')
  async updateCartItemQuantity(
    @CurrentUser() user: AuthenticatedUser,
    @Param('itemId', ParseIntPipe) itemId: number,
    @Body('delta') delta: number,
  ) {
    return this.cartService.updateCartItemQuantity(user.sub, itemId, delta);
  }

  @Delete('items/:itemId')
  async deleteCartItem(
    @CurrentUser() user: AuthenticatedUser,
    @Param('itemId', ParseIntPipe) itemId: number,
  ) {
    return this.cartService.deleteCartItem(user.sub, itemId);
  }

  @Get()
  async getCartItems(@CurrentUser() user: AuthenticatedUser) {
    return this.cartService.getCartItems(user.sub);
  }
}
