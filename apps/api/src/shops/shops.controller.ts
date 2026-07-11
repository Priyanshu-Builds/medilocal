import { Body, Controller, Get, Param, Patch, Post, Put, Query } from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { AdminRoles, Auth } from '../common/auth.decorator';
import { CurrentUser } from '../common/current-user.decorator';
import { ShopsService } from './shops.service';
import {
  CreateRiderDto,
  CreateShopDto,
  CreateShopStaffDto,
  UpdateInventoryDto,
  UpdateShopDto,
  UpsertInventoryDto,
} from './dto';
import type { JwtPayload } from '../common/jwt-payload';

@ApiTags('shops')
@Controller('shops')
export class ShopsController {
  constructor(private readonly shops: ShopsService) {}

  @Get()
  @ApiOperation({ summary: 'Active shops (optionally filtered to a zone)' })
  @ApiQuery({ name: 'zoneId', required: false })
  list(@Query('zoneId') zoneId?: string) {
    return this.shops.listPublic(zoneId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Public shop details' })
  get(@Param('id') id: string) {
    return this.shops.getPublic(id);
  }
}

@ApiTags('shop-portal')
@Controller('shop/inventory')
export class ShopInventoryController {
  constructor(private readonly shops: ShopsService) {}

  @Get()
  @Auth('shop')
  @ApiOperation({ summary: 'My shop inventory (staff)' })
  @ApiQuery({ name: 'q', required: false, description: 'Filter by medicine name' })
  list(@CurrentUser() user: JwtPayload, @Query('q') q?: string) {
    return this.shops.listInventory(user.shopId!, q);
  }

  @Post()
  @Auth('shop')
  @ApiOperation({ summary: 'Add a catalog medicine to my inventory (price must be ≤ MRP)' })
  upsert(@CurrentUser() user: JwtPayload, @Body() dto: UpsertInventoryDto) {
    return this.shops.upsertInventory(user.shopId!, dto);
  }

  @Put(':medicineId')
  @Auth('shop')
  @ApiOperation({ summary: 'Update price / stock flag for one medicine' })
  update(
    @CurrentUser() user: JwtPayload,
    @Param('medicineId') medicineId: string,
    @Body() dto: UpdateInventoryDto,
  ) {
    return this.shops.updateInventory(user.shopId!, medicineId, dto);
  }
}

@ApiTags('admin')
@Controller('admin')
export class AdminShopsController {
  constructor(private readonly shops: ShopsService) {}

  @Get('shops')
  @Auth('admin')
  @ApiOperation({ summary: 'All shops incl. pending/suspended' })
  listShops() {
    return this.shops.adminList();
  }

  @Get('shops/:id')
  @Auth('admin')
  @ApiOperation({ summary: 'Shop detail with staff and inventory' })
  getShop(@Param('id') id: string) {
    return this.shops.adminGetOne(id);
  }

  @Post('shops')
  @Auth('admin')
  @AdminRoles('OPS')
  @ApiOperation({ summary: 'Onboard a shop (created PENDING until license is verified)' })
  createShop(@Body() dto: CreateShopDto) {
    return this.shops.adminCreate(dto);
  }

  @Patch('shops/:id')
  @Auth('admin')
  @AdminRoles('OPS')
  @ApiOperation({ summary: 'Update shop details / activate / suspend' })
  updateShop(@Param('id') id: string, @Body() dto: UpdateShopDto) {
    return this.shops.adminUpdate(id, dto);
  }

  @Post('shops/:id/staff')
  @Auth('admin')
  @AdminRoles('OPS')
  @ApiOperation({ summary: 'Create a pharmacy-portal login for a shop' })
  createStaff(@Param('id') shopId: string, @Body() dto: CreateShopStaffDto) {
    return this.shops.adminCreateStaff(shopId, dto);
  }

  @Post('shops/:id/inventory')
  @Auth('admin')
  @AdminRoles('OPS')
  @ApiOperation({ summary: 'Ops-assisted: add/update inventory on a shop’s behalf' })
  upsertShopInventory(@Param('id') shopId: string, @Body() dto: UpsertInventoryDto) {
    return this.shops.upsertInventory(shopId, dto);
  }

  @Get('riders')
  @Auth('admin')
  @ApiOperation({ summary: 'All riders (for manual assignment)' })
  listRiders() {
    return this.shops.adminListRiders();
  }

  @Post('riders')
  @Auth('admin')
  @AdminRoles('OPS')
  @ApiOperation({ summary: 'Register a rider (logs in via phone OTP on the rider app)' })
  createRider(@Body() dto: CreateRiderDto) {
    return this.shops.adminCreateRider(dto);
  }
}
