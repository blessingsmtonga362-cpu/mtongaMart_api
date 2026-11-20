import { Controller, Get, Param, Post, Res } from '@nestjs/common';
import { Response } from 'express';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';
import { ReceiptsService } from './receipts.service';

@Controller('receipts')
export class ReceiptsController {
  constructor(private readonly receipts: ReceiptsService) {}
  @Get() list(@CurrentUser() user: AuthenticatedUser) {
    return this.receipts.list(user.sub);
  }
  @Get(':id') get(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    return this.receipts.get(id, user.sub);
  }
  @Get(':id/download') async download(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Res() response: Response,
  ) {
    const { receipt, bytes } = await this.receipts.download(id, user.sub);
    response.set({
      'Content-Type': 'application/pdf',
      'Content-Length': String(bytes.length),
      'Content-Disposition': `attachment; filename="${receipt.receiptNumber}.pdf"`,
      'Cache-Control': 'private, no-store',
    });
    response.end(bytes);
  }
  @Post(':id/resend-email') resend(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    return this.receipts.resend(id, user.sub);
  }
}
