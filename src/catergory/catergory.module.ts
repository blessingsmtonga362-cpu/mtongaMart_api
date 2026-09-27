import { Module } from '@nestjs/common';
import { CatergoryService } from './catergory.service';
import { CatergoryController } from './catergory.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Catergory } from './entities/catergory.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Catergory])],
  controllers: [CatergoryController],
  providers: [CatergoryService],
})
export class CatergoryModule {}
