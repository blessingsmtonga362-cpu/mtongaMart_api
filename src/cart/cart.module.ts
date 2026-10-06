import { Module } from '@nestjs/common';
import { CartService } from './cart.service';
import { CartController } from './cart.controller';
import { Cart } from './entities/cart.entity';
import { TypeOrmModule } from 'node_modules/@nestjs/typeorm/dist/typeorm.module';
import { CartItem } from './entities/cartitem.entity';
import { Users } from 'src/user/entities/user.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Cart, CartItem, Users])],
  controllers: [CartController],
  providers: [CartService],
})
export class CartModule {}
