import { IsString, IsNotEmpty } from 'class-validator';

export class CreateCatergoryDto {
  @IsString()
  @IsNotEmpty()
  name: string;
}
