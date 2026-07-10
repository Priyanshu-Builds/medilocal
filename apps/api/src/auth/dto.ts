import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsIn, IsString, MinLength } from 'class-validator';

export class DashboardLoginDto {
  @ApiProperty({ example: 'admin@medilocal.local' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'ChangeMe123!' })
  @IsString()
  @MinLength(8)
  password: string;
}

export class FirebaseLoginDto {
  @ApiProperty({ description: 'Firebase ID token obtained after phone OTP verification in the app' })
  @IsString()
  idToken: string;
}

export class RefreshDto {
  @ApiProperty()
  @IsString()
  refreshToken: string;
}

export class DevLoginDto {
  @ApiProperty({ enum: ['customer', 'rider'] })
  @IsIn(['customer', 'rider'])
  kind: 'customer' | 'rider';

  @ApiProperty({ example: '9800000010', description: 'Phone number (rider must already exist)' })
  @IsString()
  @MinLength(10)
  phone: string;
}
