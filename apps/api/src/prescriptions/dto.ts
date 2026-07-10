import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export const RX_CONTENT_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'] as const;

export class UploadUrlDto {
  @ApiProperty({ enum: RX_CONTENT_TYPES, example: 'image/jpeg' })
  @IsIn(RX_CONTENT_TYPES as readonly string[])
  contentType: string;
}

export class VerifyRxDto {
  @ApiProperty({ description: 'true = approve; false = reject the prescription AND the order' })
  @IsBoolean()
  approve: boolean;

  @ApiPropertyOptional({ description: 'Required when rejecting — shown to the customer' })
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(300)
  rejectionReason?: string;
}
