import { Module } from '@nestjs/common';
import { ProductsService } from './products.service';
import { ProductsController } from './products.controller';
import { Product } from './entities/product.entity';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Catergory } from 'src/catergory/entities/catergory.entity';
import { CartItem } from 'src/cart/entities/cartitem.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Product, Catergory, CartItem])],
  controllers: [ProductsController],
  providers: [ProductsService],
})
export class ProductsModule {}
