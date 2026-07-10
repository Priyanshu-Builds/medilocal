import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { RX_STATUSES, type RxStatus } from '@medilocal/shared';
import { AdminRoles, Auth } from '../common/auth.decorator';
import { CurrentUser } from '../common/current-user.decorator';
import { PrescriptionsService } from './prescriptions.service';
import { UploadUrlDto, VerifyRxDto } from './dto';
import type { JwtPayload } from '../common/jwt-payload';

@ApiTags('prescriptions')
@Controller('prescriptions')
export class PrescriptionsController {
  constructor(private readonly prescriptions: PrescriptionsService) {}

  @Post('upload-url')
  @Auth('customer')
  @ApiOperation({
    summary:
      'Get a presigned PUT URL to upload a prescription (private bucket). Pass the returned fileKey in order creation.',
  })
  uploadUrl(@CurrentUser() user: JwtPayload, @Body() dto: UploadUrlDto) {
    return this.prescriptions.createUploadUrl(user.sub, dto.contentType);
  }

  @Get(':id/view-url')
  @Auth('admin', 'shop', 'customer')
  @ApiOperation({ summary: 'Short-lived signed URL to view a prescription image (scoped to the order parties)' })
  viewUrl(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.prescriptions.createViewUrl(user, id);
  }
}

@ApiTags('admin')
@Controller('admin/prescriptions')
export class AdminPrescriptionsController {
  constructor(private readonly prescriptions: PrescriptionsService) {}

  @Get()
  @Auth('admin')
  @AdminRoles('PHARMACIST')
  @ApiOperation({ summary: 'Prescription verification queue' })
  @ApiQuery({ name: 'status', required: false, enum: RX_STATUSES })
  queue(@Query('status') status?: RxStatus) {
    return this.prescriptions.adminQueue(status ?? 'PENDING');
  }

  @Post(':id/verify')
  @Auth('admin')
  @AdminRoles('PHARMACIST')
  @ApiOperation({ summary: 'Approve or reject a prescription (rejecting also rejects + refunds the order)' })
  verify(@CurrentUser() user: JwtPayload, @Param('id') id: string, @Body() dto: VerifyRxDto) {
    return this.prescriptions.adminVerify(user.sub, id, dto.approve, dto.rejectionReason);
  }
}

@ApiTags('shop-portal')
@Controller('shop/prescriptions')
export class ShopPrescriptionsController {
  constructor(private readonly prescriptions: PrescriptionsService) {}

  @Post(':id/verify')
  @Auth('shop')
  @ApiOperation({ summary: 'Verify a prescription for my shop’s order (registered pharmacists only)' })
  verify(@CurrentUser() user: JwtPayload, @Param('id') id: string, @Body() dto: VerifyRxDto) {
    return this.prescriptions.shopVerify(user.sub, user.shopId!, id, dto.approve, dto.rejectionReason);
  }
}
