import { Body, Controller, Delete, Get, Param, Patch, Post, Put } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Auth } from '../common/auth.decorator';
import { CurrentUser } from '../common/current-user.decorator';
import { UsersService } from './users.service';
import { CreateAddressDto, FcmTokenDto, UpdateAddressDto, UpdateMeDto } from './dto';
import type { JwtPayload } from '../common/jwt-payload';

@ApiTags('me')
@Controller('me')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get()
  @Auth('customer')
  @ApiOperation({ summary: 'Current customer profile with saved addresses' })
  me(@CurrentUser() user: JwtPayload) {
    return this.users.me(user.sub);
  }

  @Patch()
  @Auth('customer')
  @ApiOperation({ summary: 'Update profile (name/email)' })
  updateMe(@CurrentUser() user: JwtPayload, @Body() dto: UpdateMeDto) {
    return this.users.updateMe(user.sub, dto);
  }

  @Delete()
  @Auth('customer')
  @ApiOperation({
    summary: 'Delete my account — erases personal data (addresses, profile) and blocks future login',
  })
  deleteMe(@CurrentUser() user: JwtPayload) {
    return this.users.deleteMe(user.sub);
  }

  @Put('fcm-token')
  @Auth('customer', 'rider')
  @ApiOperation({ summary: 'Register this device for push notifications (customer or rider token)' })
  saveFcmToken(@CurrentUser() user: JwtPayload, @Body() dto: FcmTokenDto) {
    return this.users.saveFcmToken(user.kind as 'customer' | 'rider', user.sub, dto.token);
  }

  @Post('addresses')
  @Auth('customer')
  @ApiOperation({ summary: 'Add a delivery address (must carry a zoneId from GET /v1/zones)' })
  createAddress(@CurrentUser() user: JwtPayload, @Body() dto: CreateAddressDto) {
    return this.users.createAddress(user.sub, dto);
  }

  @Patch('addresses/:id')
  @Auth('customer')
  @ApiOperation({ summary: 'Edit a saved address' })
  updateAddress(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: UpdateAddressDto,
  ) {
    return this.users.updateAddress(user.sub, id, dto);
  }

  @Delete('addresses/:id')
  @Auth('customer')
  @ApiOperation({ summary: 'Delete a saved address' })
  deleteAddress(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.users.deleteAddress(user.sub, id);
  }
}
