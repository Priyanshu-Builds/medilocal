import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';

export class QuoteItemDto {
  @ApiProperty()
  @IsString()
  medicineId: string;

  @ApiProperty({ minimum: 1, maximum: 50 })
  @IsInt()
  @Min(1)
  @Max(50)
  qty: number;
}

export class CartQuoteDto {
  @ApiProperty({ description: 'Delivery zone (from the chosen address)' })
  @IsString()
  zoneId: string;

  @ApiPropertyOptional({
    description: 'Pin a specific shop; omit to let the platform pick the best-covering shop in the zone',
  })
  @IsOptional()
  @IsString()
  shopId?: string;

  @ApiProperty({ type: [QuoteItemDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(30)
  @ValidateNested({ each: true })
  @Type(() => QuoteItemDto)
  items: QuoteItemDto[];
}
