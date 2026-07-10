import {
  BadRequestException,
  Body,
  Controller,
  Headers,
  HttpCode,
  Post,
  RawBodyRequest,
  Req,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ApiExcludeEndpoint, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { Auth } from '../common/auth.decorator';
import { PaymentsService } from './payments.service';
import { RazorpayService } from './razorpay.service';
import { CheckoutVerifyDto } from './dto';
import { verifyCheckoutSignature, verifyWebhookSignature } from './signature';

@ApiTags('payments')
@Controller('payments')
export class PaymentsController {
  constructor(
    private readonly payments: PaymentsService,
    private readonly razorpay: RazorpayService,
  ) {}

  /**
   * The single source of truth for payment confirmation ("never trust the
   * client"). Configure this URL in the Razorpay dashboard with the same
   * webhook secret as RAZORPAY_WEBHOOK_SECRET.
   */
  @Post('razorpay/webhook')
  @HttpCode(200)
  @ApiExcludeEndpoint() // machine-to-machine; keep it out of the client-facing spec
  async webhook(
    @Req() req: RawBodyRequest<Request>,
    @Headers('x-razorpay-signature') signature?: string,
  ) {
    const secret = this.razorpay.webhookSecret;
    if (!secret) {
      throw new ServiceUnavailableException('Webhook secret not configured');
    }
    if (!req.rawBody || !verifyWebhookSignature(req.rawBody, signature, secret)) {
      throw new BadRequestException('Invalid webhook signature');
    }
    const body = req.body as { event?: string; payload?: Record<string, unknown> };
    if (body?.event) {
      await this.payments.handleWebhookEvent(body.event, body.payload ?? {});
    }
    return { status: 'ok' };
  }

  /**
   * Optimistic confirmation from the app's checkout success handler; verified
   * with the key secret, so it is safe — the webhook remains authoritative
   * and idempotent either way.
   */
  @Post('razorpay/verify')
  @Auth('customer')
  @HttpCode(200)
  @ApiOperation({ summary: 'Verify the Razorpay Checkout success signature and confirm the payment' })
  async verify(@Body() dto: CheckoutVerifyDto) {
    const valid = verifyCheckoutSignature(
      dto.razorpayOrderId,
      dto.razorpayPaymentId,
      dto.razorpaySignature,
      this.razorpay.keySecret,
    );
    if (!valid) throw new BadRequestException('Invalid payment signature');
    const order = await this.payments.markCaptured(dto.razorpayOrderId, dto.razorpayPaymentId);
    if (!order) throw new BadRequestException('Unknown payment');
    return { orderId: order.id, paymentState: order.paymentState };
  }
}
