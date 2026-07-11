import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsLatitude,
  IsLongitude,
  IsOptional,
  IsString,
  Length,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { DELIVERY_OTP_LENGTH, ORDER_STATES, type OrderState } from '@medilocal/shared';

export class OrderItemInputDto {
  @ApiProperty()
  @IsString()
  medicineId: string;

  @ApiProperty({ minimum: 1, maximum: 50 })
  @IsInt()
  @Min(1)
  @Max(50)
  qty: number;
}

export class CreateOrderDto {
  @ApiProperty({ description: 'One of my saved addresses (its zone decides fees & the serving shop)' })
  @IsString()
  addressId: string;

  @ApiPropertyOptional({ description: 'Pin a shop; omit to let the platform pick (same rule as cart quote)' })
  @IsOptional()
  @IsString()
  shopId?: string;

  @ApiProperty({ enum: ['RAZORPAY', 'COD'] })
  @IsIn(['RAZORPAY', 'COD'])
  paymentMethod: 'RAZORPAY' | 'COD';

  @ApiProperty({ type: [OrderItemInputDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(30)
  @ValidateNested({ each: true })
  @Type(() => OrderItemInputDto)
  items: OrderItemInputDto[];

  @ApiPropertyOptional({
    type: [String],
    description:
      'S3 file keys from POST /v1/prescriptions/upload-url — required when any item needs a prescription',
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(5)
  @IsString({ each: true })
  rxFileKeys?: string[];
}

export class ItemDecisionDto {
  @ApiProperty()
  @IsString()
  orderItemId: string;

  @ApiProperty({ description: 'false = shop does not have it → item is dropped and auto-refunded' })
  @IsBoolean()
  accepted: boolean;
}

export class ShopAcceptDto {
  @ApiProperty({ type: [ItemDecisionDto], description: 'A decision for every item on the order' })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ItemDecisionDto)
  items: ItemDecisionDto[];
}

export class AssignRiderDto {
  @ApiProperty()
  @IsString()
  riderId: string;
}

export class DeliverDto {
  @ApiProperty({
    minLength: DELIVERY_OTP_LENGTH,
    maxLength: DELIVERY_OTP_LENGTH,
    description: 'Handoff code the customer reads out from their app',
  })
  @IsString()
  @Length(DELIVERY_OTP_LENGTH, DELIVERY_OTP_LENGTH)
  otp: string;
}

export class ReasonDto {
  @ApiProperty({ example: 'Customer not reachable at the address' })
  @IsString()
  @MinLength(3)
  @MaxLength(300)
  reason: string;
}

export class CancelDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(300)
  reason?: string;
}

export class DutyDto {
  @ApiProperty({ description: 'true = go on duty (receive task offers), false = go off duty' })
  @IsBoolean()
  onDuty: boolean;
}

export class RiderLocationDto {
  @ApiProperty({ example: 25.6, description: 'Current latitude' })
  @IsLatitude()
  lat: number;

  @ApiProperty({ example: 85.1, description: 'Current longitude' })
  @IsLongitude()
  lng: number;
}

export class AdminTransitionDto {
  @ApiProperty({ enum: ORDER_STATES })
  @IsIn(ORDER_STATES as readonly string[])
  toState: OrderState;

  @ApiProperty({ description: 'Why ops is overriding — goes into the order audit trail' })
  @IsString()
  @MinLength(3)
  @MaxLength(300)
  note: string;
}
