import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Catergory } from './entities/catergory.entity';
import { Repository } from 'typeorm';
import { CreateCatergoryDto } from './dto/create-catergory.dto';
import { CloudinaryService } from '../cloudinary/cloudinary.service';

@Injectable()
export class CatergoryService {
  constructor(
    @InjectRepository(Catergory)
    private readonly categortRepository: Repository<Catergory>,
    private readonly cloudinaryService: CloudinaryService,
  ) {}

  async createCategory(
    catergory: CreateCatergoryDto,
    file: Express.Multer.File,
  ) {
    if (!file) {
      throw new BadRequestException('Category image is required');
    }

    const imageUrl = await this.cloudinaryService.uploadImage(
      file,
      'categories',
    );

    const details = this.categortRepository.create({
      name: catergory.name,
      image: imageUrl,
    });

    return this.categortRepository.save(details);
  }

  findAllCategories(): Promise<Catergory[]> {
    return this.categortRepository.find();
  }
}
