import { Test, TestingModule } from '@nestjs/testing';
import { CatergoryController } from './catergory.controller';
import { CatergoryService } from './catergory.service';

describe('CatergoryController', () => {
  let controller: CatergoryController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [CatergoryController],
      providers: [CatergoryService],
    }).compile();

    controller = module.get<CatergoryController>(CatergoryController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
