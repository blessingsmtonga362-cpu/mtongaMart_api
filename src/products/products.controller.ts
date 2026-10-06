import { Controller, Get, Post, Body, Inject, Param } from '@nestjs/common';
import { ProductsService } from './products.service';
import { Product } from './entities/product.entity';

import { InjectRepository } from '@nestjs/typeorm';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { UploadedFile, UseInterceptors } from '@nestjs/common';
import { Repository } from 'typeorm';

@Controller('products')
export class ProductsController {
  constructor(
    @InjectRepository(Product)
    private productRepo: Repository<Product>,
    private readonly productService: ProductsService,
  ) {}
  @Post()
  @UseInterceptors(
    FileInterceptor('image', {
      storage: diskStorage({
        destination: './uploads/products',
        filename: (req, file, callback) => {
          callback(null, Date.now() + extname(file.originalname));
        },
      }),
    }),
  )
  async create(
    @Body() product: Product,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.productService.create(product, file);
  }

  @Get()
  async findAll() {
    return this.productService.kupeza();
    //  return this.productService.kupeza();
  }
  @Get('single/:id')
  async findInCategories(@Param('id') id: number): Promise<Product[]> {
    return this.productService.findCategories(id);
  }
}
