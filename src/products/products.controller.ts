import { Controller, Get, Post, Body, Inject } from '@nestjs/common';
import { ProductsService } from './products.service';
import { Product } from './entities/product.entity';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { UploadedFile, UseInterceptors } from '@nestjs/common';

@Controller('products')
export class ProductsController {
  constructor(
    @InjectRepository(Product)
    private ProductRepository: Repository<Product>,
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
    const details = this.ProductRepository.create({
      name: product.name,
      price: product.price,
      image: `http://172.21.204.184:3000/uploads/products/${file.filename}`,
      review: product.review,
      rate: product.rate,
    });
    return this.ProductRepository.save(details);
  }

  @Get()
  async findAll(): Promise<Product[]> {
    return this.ProductRepository.find();
  }
}
