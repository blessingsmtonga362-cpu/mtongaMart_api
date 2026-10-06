import { Injectable } from '@nestjs/common';
import { Product } from './entities/product.entity';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';

@Injectable()
export class ProductsService {
  constructor(
    @InjectRepository(Product)
    private readonly productRepository: Repository<Product>,
  ) {}

  async create(product: Product, file: Express.Multer.File) {
    const details = this.productRepository.create({
      name: product.name,
      price: product.price,
      image: `http://192.168.1.219:3000/uploads/products/${file.filename}`,
      review: product.review,
      rate: product.rate,
      catergory: product.catergory,
    });
    return this.productRepository.save(details);
  }

  async kupeza(): Promise<Product[]> {
    return this.productRepository.find();
  }

  async findCategories(id: number): Promise<Product[]> {
    return this.productRepository.find({
      where: { catergory: { id: id } },
    });
  }
}
