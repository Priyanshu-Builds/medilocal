import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsIn,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  MaxLength,
} from 'class-validator';
import { DRUG_SCHEDULES, type DrugSchedule } from '@medilocal/shared';

// The catalog never sells Schedule X, so admins can only create NONE/H/H1.
const CREATABLE_SCHEDULES = DRUG_SCHEDULES.filter((s) => s !== 'X');

export class CreateMedicineDto {
  @ApiProperty({ example: 'Dolo 650' })
  @IsString()
  @MaxLength(160)
  name: string;

  @ApiPropertyOptional({ example: 'Dolo' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  brand?: string;

  @ApiPropertyOptional({ example: 'Paracetamol 650mg' })
  @IsOptional()
  @IsString()
  @MaxLength(160)
  genericName?: string;

  @ApiPropertyOptional({ example: 'Micro Labs' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  manufacturer?: string;

  @ApiProperty({ example: 33.6 })
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  mrpInr: number;

  @ApiPropertyOptional({ example: 'Strip of 15 tablets' })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  packSize?: string;

  @ApiPropertyOptional({ enum: CREATABLE_SCHEDULES, default: 'NONE' })
  @IsOptional()
  @IsIn(CREATABLE_SCHEDULES as readonly string[])
  schedule?: Exclude<DrugSchedule, 'X'>;

  @ApiPropertyOptional({ description: 'Auto-forced true for H/H1' })
  @IsOptional()
  @IsBoolean()
  rxRequired?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  imageUrl?: string;
}

export class UpdateMedicineDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(160)
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  brand?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(160)
  genericName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  manufacturer?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  mrpInr?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(80)
  packSize?: string;

  @ApiPropertyOptional({ enum: CREATABLE_SCHEDULES })
  @IsOptional()
  @IsIn(CREATABLE_SCHEDULES as readonly string[])
  schedule?: Exclude<DrugSchedule, 'X'>;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  rxRequired?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  imageUrl?: string;
}

export class ImportCsvDto {
  @ApiProperty({
    description:
      'Raw CSV text. Header: name,brand,genericName,manufacturer,mrpInr,packSize,schedule,rxRequired. Upserts by name (case-insensitive).',
  })
  @IsString()
  csv: string;
}
