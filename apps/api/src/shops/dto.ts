import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsEmail,
  IsIn,
  IsLatitude,
  IsLongitude,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

export class UpsertInventoryDto {
  @ApiProperty({ description: 'Master-catalog medicine id' })
  @IsString()
  medicineId: string;

  @ApiProperty({ example: 33.6, description: 'Selling price in INR — must be ≤ the medicine MRP' })
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  priceInr: number;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  inStock?: boolean;
}

export class UpdateInventoryDto {
  @ApiPropertyOptional({ example: 30.0, description: 'Selling price in INR — must be ≤ MRP' })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  priceInr?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  inStock?: boolean;
}

export class CreateShopDto {
  @ApiProperty()
  @IsString()
  cityId: string;

  @ApiProperty()
  @IsString()
  zoneId: string;

  @ApiProperty({ example: 'Sri Balaji Medical Store' })
  @IsString()
  @MaxLength(120)
  name: string;

  @ApiProperty({ description: 'Drug license number — verify the paper copy before activating' })
  @IsString()
  @MaxLength(60)
  licenseNo: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(20)
  gstin?: string;

  @ApiProperty({ example: '9800000001' })
  @IsString()
  @MinLength(10)
  @MaxLength(15)
  phone: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiProperty()
  @IsString()
  @MaxLength(200)
  addressLine: string;

  @ApiProperty({ example: 25.5941 })
  @IsLatitude()
  lat: number;

  @ApiProperty({ example: 85.1376 })
  @IsLongitude()
  lng: number;

  @ApiPropertyOptional({ example: 10, description: 'Platform commission %' })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(50)
  commissionPct?: number;

  @ApiPropertyOptional({ example: '09:00' })
  @IsOptional()
  @Matches(TIME_RE)
  openTime?: string;

  @ApiPropertyOptional({ example: '22:00' })
  @IsOptional()
  @Matches(TIME_RE)
  closeTime?: string;
}

export class UpdateShopDto {
  @ApiPropertyOptional({ enum: ['PENDING', 'ACTIVE', 'SUSPENDED'] })
  @IsOptional()
  @IsIn(['PENDING', 'ACTIVE', 'SUSPENDED'])
  status?: 'PENDING' | 'ACTIVE' | 'SUSPENDED';

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(60)
  licenseNo?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(20)
  gstin?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(10)
  @MaxLength(15)
  phone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  addressLine?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsLatitude()
  lat?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsLongitude()
  lng?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(50)
  commissionPct?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Matches(TIME_RE)
  openTime?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Matches(TIME_RE)
  closeTime?: string;
}

export class CreateShopStaffDto {
  @ApiProperty()
  @IsString()
  @MaxLength(80)
  name: string;

  @ApiProperty()
  @IsEmail()
  email: string;

  @ApiProperty({ example: '9800000002' })
  @IsString()
  @MinLength(10)
  @MaxLength(15)
  phone: string;

  @ApiProperty({ minLength: 8 })
  @IsString()
  @MinLength(8)
  password: string;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  isPharmacist?: boolean;

  @ApiPropertyOptional({ description: 'State pharmacy council registration number' })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  pharmacistRegNo?: string;
}

export class CreateRiderDto {
  @ApiProperty()
  @IsString()
  @MaxLength(80)
  name: string;

  @ApiProperty({ example: '9800000003' })
  @IsString()
  @MinLength(10)
  @MaxLength(15)
  phone: string;

  @ApiPropertyOptional({ example: 'BR01AB1234' })
  @IsOptional()
  @IsString()
  @MaxLength(15)
  vehicleNo?: string;
}
