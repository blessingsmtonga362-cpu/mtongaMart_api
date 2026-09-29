import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Catergory } from './entities/catergory.entity';
import { Repository } from 'typeorm';

@Injectable()
export class CatergoryService {
  constructor(
    @InjectRepository(Catergory)
    private readonly categortRepository: Repository<Catergory>,
  ) {}
}
