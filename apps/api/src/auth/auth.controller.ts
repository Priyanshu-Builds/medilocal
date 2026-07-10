import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { DashboardLoginDto, FirebaseLoginDto, RefreshDto } from './dto';
import { JwtAuthGuard } from './jwt-auth.guard';

@ApiTags('auth')
@Controller('auth')
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

  @Post('refresh')
  @ApiOperation({ summary: 'Exchange a refresh token for a new token pair' })
  refresh(@Body() dto: RefreshDto) {
    return this.auth.refresh(dto.refreshToken);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Decode the current bearer token (sanity check for clients)' })
  me(@Req() req: { user: unknown }) {
    return req.user;
  }
}
