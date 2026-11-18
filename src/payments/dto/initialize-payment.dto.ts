import { IsIn, IsString, Matches, MaxLength } from 'class-validator';

export class InitializePaymentDto {
  @IsString()
  @MaxLength(36)
  orderId: string;

  @IsIn(['airtel', 'tnm'])
  operator: 'airtel' | 'tnm';

  @IsString()
  @Matches(/^0(?:88|89|98|99)\d{7}$/)
  mobile: string;
}
