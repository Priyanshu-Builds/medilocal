import { Body, Controller, Get, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { Auth } from '../common/auth.decorator';
import { CurrentUser } from '../common/current-user.decorator';
import { DashboardLoginDto, DevLoginDto, FirebaseLoginDto, RefreshDto } from './dto';
import type { JwtPayload } from '../common/jwt-payload';

@ApiTags('auth')
@Controller('auth')
// Credential + token endpoints are brute-force targets → 10 attempts/min per IP.
@Throttle({ default: { limit: 10, ttl: 60_000 } })
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('admin/login')
  @ApiOperation({ summary: 'Admin dashboard login (email + password)' })
  adminLogin(@Body() dto: DashboardLoginDto) {
    return this.auth.adminLogin(dto.email, dto.password);
  }

  @Post('shop/login')
  @ApiOperation({ summary: 'Pharmacy dashboard login (email + password)' })
  shopLogin(@Body() dto: DashboardLoginDto) {
    return this.auth.shopLogin(dto.email, dto.password);
  }

  @Post('customer/firebase')
  @ApiOperation({ summary: 'Customer login: exchange a Firebase phone-auth ID token for API JWTs' })
  customerFirebase(@Body() dto: FirebaseLoginDto) {
    return this.auth.customerFirebaseLogin(dto.idToken);
  }

  @Post('rider/firebase')
  @ApiOperation({ summary: 'Rider login: same Firebase phone OTP, but only pre-registered riders' })
  riderFirebase(@Body() dto: FirebaseLoginDto) {
    return this.auth.riderFirebaseLogin(dto.idToken);
  }

  @Post('dev/login')
  @ApiOperation({
    summary: 'DEV ONLY: mint a customer/rider token by phone (requires DEV_LOGIN_ENABLED=true)',
  })
  devLogin(@Body() dto: DevLoginDto) {
    return this.auth.devLogin(dto.kind, dto.phone);
  }

  @Post('refresh')
  @ApiOperation({ summary: 'Exchange a refresh token for a new token pair' })
  refresh(@Body() dto: RefreshDto) {
    return this.auth.refresh(dto.refreshToken);
  }

  @Get('me')
  @Auth()
  @ApiOperation({ summary: 'Decode the current bearer token (sanity check for clients)' })
  me(@CurrentUser() user: JwtPayload) {
    return user;
  }
}
