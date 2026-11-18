import { IsIn } from 'class-validator';

export class CreateOrderDto {
  @IsIn(['shop', 'courier'])
  deliveryMethod: 'shop' | 'courier';
}
