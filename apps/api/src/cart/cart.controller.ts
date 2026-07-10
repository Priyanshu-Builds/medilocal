import { Body, Controller, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Auth } from '../common/auth.decorator';
import { CartService } from './cart.service';
import { CartQuoteDto } from './dto';

@ApiTags('cart')
@Controller('cart')
export class CartController {
  constructor(private readonly cart: CartService) {}

  @Post('quote')
  @Auth('customer')
  @ApiOperation({
    summary:
      'Price a cart: per-item availability & prices, delivery fee, min-order and COD checks, Rx flags. Call before checkout.',
  })
  quote(@Body() dto: CartQuoteDto) {
    return this.cart.buildQuote(dto.zoneId, dto.shopId, dto.items);
  }
}
