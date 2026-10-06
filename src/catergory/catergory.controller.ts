import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { CatergoryService } from './catergory.service';
import { CreateCatergoryDto } from './dto/create-catergory.dto';
import { UpdateCatergoryDto } from './dto/update-catergory.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { Catergory } from './entities/catergory.entity';
import { Inject } from '@nestjs/common';
import { Repository } from 'typeorm';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { FileInterceptor } from '@nestjs/platform-express';
@Controller()
export class CatergoryController {
  constructor(
    @InjectRepository(Catergory)
    private categoryRepo: Repository<Catergory>,
    private readonly catergoryService: CatergoryService,
  ) {}

  @Post('bule')
  @UseInterceptors(
    FileInterceptor('image', {
      storage: diskStorage({
        destination: './uploads/catergory',
        filename: (req, file, callback) => {
          callback(null, Date.now() + extname(file.originalname));
        },
      }),
    }),
  )
  async create(
    @Body() catergory: Catergory,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.catergoryService.createCategory(catergory, file);
  }

  @Get('bule')
  async findAll(): Promise<Catergory[]> {
    return this.categoryRepo.find();
  }
}
