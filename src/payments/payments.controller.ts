import { Body, Controller, Get, Headers, Param, Post, Req } from '@nestjs/common';
import { Request } from 'express';
import { Public } from '../auth/decorators/public.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';
import { InitializePaymentDto } from './dto/initialize-payment.dto';
import { PaymentsService } from './payments.service';

type RawBodyRequest = Request & { rawBody?: Buffer };

@Controller('payments')
export class PaymentsController {
  constructor(private readonly payments: PaymentsService) {}

  @Post('initialize')
  initialize(@CurrentUser() user: AuthenticatedUser, @Body() body: InitializePaymentDto) {
    return this.payments.initialize(user.sub, body);
  }

  @Get(':paymentId/status')
  getStatus(@CurrentUser() user: AuthenticatedUser, @Param('paymentId') id: string) {
    return this.payments.getStatus(id, user.sub);
  }

  @Get('orders/:orderId/status')
  getOrderStatus(@CurrentUser() user: AuthenticatedUser, @Param('orderId') id: string) {
    return this.payments.getOrderPaymentStatus(id, user.sub);
  }

  @Public()
  @Post('webhook')
  webhook(@Req() request: RawBodyRequest, @Headers('signature') signature?: string) {
    return this.payments.handleWebhook(request.rawBody ?? Buffer.alloc(0), signature);
  }
}
