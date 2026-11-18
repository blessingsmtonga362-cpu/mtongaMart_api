import { ArgumentMetadata, ValidationPipe } from '@nestjs/common';
import { CreateCartDto } from './create-cart.dto';

describe('CreateCartDto', () => {
  const validationPipe = new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
  });
  const metadata: ArgumentMetadata = {
    type: 'body',
    metatype: CreateCartDto,
    data: undefined,
  };

  it('accepts productId and quantity with whitelist validation enabled', async () => {
    const result = await validationPipe.transform(
      { productId: 12, quantity: 2 },
      metadata,
    );

    expect(result).toBeInstanceOf(CreateCartDto);
    expect(result).toMatchObject({ productId: 12, quantity: 2 });
  });

  it('rejects non-positive product IDs and quantities', async () => {
    await expect(
      validationPipe.transform({ productId: 0, quantity: 0 }, metadata),
    ).rejects.toMatchObject({ status: 400 });
  });
});
