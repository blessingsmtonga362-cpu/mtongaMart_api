import {
  Controller,
  Get,
  Post,
  Body,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
} from '@nestjs/common';

import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';

import { CatergoryService } from './catergory.service';
import { CreateCatergoryDto } from './dto/create-catergory.dto';
import { Public } from '../auth/decorators/public-route.decorator';

@Public()
@Controller()
export class CatergoryController {
  constructor(private readonly catergoryService: CatergoryService) {}

  @Post('bule')
  @UseInterceptors(
    FileInterceptor('image', {
      storage: memoryStorage(),
      limits: {
        fileSize: 5 * 1024 * 1024,
      },
      fileFilter: (req, file, callback) => {
        if (!file.mimetype.startsWith('image/')) {
          return callback(
            new BadRequestException('Only image files are allowed'),
            false,
          );
        }

        callback(null, true);
      },
    }),
  )
  async create(
    @Body() createCatergoryDto: CreateCatergoryDto,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.catergoryService.createCategory(createCatergoryDto, file);
  }

  @Get('bule')
  async findAll() {
    return this.catergoryService.findAllCategories();
  }
}
