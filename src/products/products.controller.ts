import { Controller, Get, Post, Body, Inject, Param } from '@nestjs/common';
import { ProductsService } from './products.service';
import { Product } from './entities/product.entity';
import { CreateProductDto } from './dto/create-product.dto';
import { Public } from '../auth/decorators/public.decorator';

import { InjectRepository } from '@nestjs/typeorm';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { UploadedFile, UseInterceptors } from '@nestjs/common';
import { Repository } from 'typeorm';

@Public()
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
    @Body() createProductDto: CreateProductDto,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.productService.create(createProductDto, file);
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
