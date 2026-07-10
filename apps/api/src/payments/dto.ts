import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class CheckoutVerifyDto {
  @ApiProperty({ example: 'order_XXXXXXXXXXXXXX' })
  @IsString()
  razorpayOrderId: string;

  @ApiProperty({ example: 'pay_XXXXXXXXXXXXXX' })
  @IsString()
  razorpayPaymentId: string;

  @ApiProperty({ description: 'Signature from the Razorpay Checkout success handler' })
  @IsString()
  razorpaySignature: string;
}
