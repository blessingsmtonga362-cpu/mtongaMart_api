import { IsString, IsNotEmpty, IsNumber, IsOptional } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateProductDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsNumber()
  @Type(() => Number)
  price: number;

  @IsNumber()
  @Type(() => Number)
  @IsOptional()
  review?: number;

  @IsNumber()
  @Type(() => Number)
  @IsOptional()
  rate?: number;

  @IsOptional()
  catergory?: any;
}
