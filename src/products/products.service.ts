import { Injectable, BadRequestException } from '@nestjs/common';
import { Product } from './entities/product.entity';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { CreateProductDto } from './dto/create-product.dto';
import { CloudinaryService } from '../cloudinary/cloudinary.service';

@Injectable()
export class ProductsService {
  constructor(
    @InjectRepository(Product)
    private readonly productRepository: Repository<Product>,
    private readonly cloudinaryService: CloudinaryService,
  ) {}

  async create(product: CreateProductDto, file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('Product image is required');
    }

    const imageUrl = await this.cloudinaryService.uploadImage(file, 'products');

    const details = this.productRepository.create({
      name: product.name,
      price: product.price,
      image: imageUrl,
      catergory: product.catergory,
    });

    return this.productRepository.save(details);
  }

  async kupeza(): Promise<Product[]> {
    return this.productRepository.find();
  }

  async findCategories(id: string): Promise<Product[]> {
    return this.productRepository.find({
      where: { catergory: { id: id } },
    });
  }
}
