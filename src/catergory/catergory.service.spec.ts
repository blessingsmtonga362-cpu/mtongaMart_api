import { Test, TestingModule } from '@nestjs/testing';
import { CatergoryService } from './catergory.service';

describe('CatergoryService', () => {
  let service: CatergoryService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [CatergoryService],
    }).compile();

    service = module.get<CatergoryService>(CatergoryService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
