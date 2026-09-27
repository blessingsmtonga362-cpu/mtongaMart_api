import { PartialType } from '@nestjs/mapped-types';
import { CreateCatergoryDto } from './create-catergory.dto';

export class UpdateCatergoryDto extends PartialType(CreateCatergoryDto) {}
