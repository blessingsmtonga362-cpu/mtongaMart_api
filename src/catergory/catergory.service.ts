import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Catergory } from './entities/catergory.entity';
import { Repository } from 'typeorm';
import { CreateCatergoryDto } from './dto/create-catergory.dto';

@Injectable()
export class CatergoryService {
  constructor(
    @InjectRepository(Catergory)
    private readonly categortRepository: Repository<Catergory>,
  ) {}
  createCategory(catergory: CreateCatergoryDto, file: Express.Multer.File) {
    const details = this.categortRepository.create({
      name: catergory.name,
      image: `http://192.168.1.219:3000/uploads/catergory/${file.filename}`,
    });
    return this.categortRepository.save(details);
  }
  findAllCategories(): Promise<Catergory[]> {
    return this.categortRepository.find();
  }
}
