import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { ORDER_STATES, type OrderState } from '@medilocal/shared';
import { AdminRoles, Auth } from '../common/auth.decorator';
import { CurrentUser } from '../common/current-user.decorator';
import { OrderActionsService } from './order-actions.service';
import { OrdersService } from './orders.service';
import {
  AdminTransitionDto,
  AssignRiderDto,
  CancelDto,
  CreateOrderDto,
  DeliverDto,
  DutyDto,
  ReasonDto,
  RiderLocationDto,
  ShopAcceptDto,
} from './dto';
import { RiderService } from './rider.service';
import type { JwtPayload } from '../common/jwt-payload';

@ApiTags('orders')
@Controller('orders')
export class OrdersController {
  constructor(
    private readonly orders: OrdersService,
    private readonly actions: OrderActionsService,
  ) {}

  @Post()
  @Auth('customer')
  @ApiOperation({
    summary:
      'Place an order. Server re-prices everything; Razorpay orders return checkout params and stay PENDING until the payment webhook confirms.',
  })
  create(@CurrentUser() user: JwtPayload, @Body() dto: CreateOrderDto) {
    return this.orders.create(user.sub, dto);
  }

  @Get()
  @Auth('customer')
  @ApiOperation({ summary: 'My orders (latest first)' })
  list(@CurrentUser() user: JwtPayload) {
    return this.orders.listForCustomer(user.sub);
  }

  @Get(':id')
  @Auth('customer')
  @ApiOperation({ summary: 'My order detail — includes the delivery code to hand to the rider' })
  get(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.orders.getForCustomer(user.sub, id);
  }

  @Post(':id/cancel')
  @Auth('customer')
  @ApiOperation({ summary: 'Cancel my order (allowed until the shop packs it); prepaid amounts auto-refund' })
  cancel(@CurrentUser() user: JwtPayload, @Param('id') id: string, @Body() dto: CancelDto) {
    return this.actions.customerCancel(user.sub, id, dto.reason);
  }
}

@ApiTags('shop-portal')
@Controller('shop/orders')
export class ShopOrdersController {
  constructor(
    private readonly orders: OrdersService,
    private readonly actions: OrderActionsService,
  ) {}

  @Get()
  @Auth('shop')
  @ApiOperation({ summary: 'Orders for my shop (unpaid online orders are hidden until payment lands)' })
  @ApiQuery({ name: 'state', required: false, enum: ORDER_STATES })
  list(@CurrentUser() user: JwtPayload, @Query('state') state?: OrderState) {
    return this.orders.listForShop(user.shopId!, state);
  }

  @Get(':id')
  @Auth('shop')
  @ApiOperation({ summary: 'Order detail for my shop' })
  get(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.orders.getForShop(user.shopId!, id);
  }

  @Post(':id/accept')
  @Auth('shop')
  @ApiOperation({
    summary:
      'Confirm availability item-by-item. Dropped items auto-refund; zero available items cancels the order.',
  })
  accept(@CurrentUser() user: JwtPayload, @Param('id') id: string, @Body() dto: ShopAcceptDto) {
    return this.actions.shopAccept(user.shopId!, user.sub, id, dto.items);
  }

  @Post(':id/pack')
  @Auth('shop')
  @ApiOperation({ summary: 'Mark the order packed and ready for rider pickup' })
  pack(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.actions.shopPack(user.shopId!, user.sub, id);
  }
}

@ApiTags('admin')
@Controller('admin/orders')
export class AdminOrdersController {
  constructor(
    private readonly orders: OrdersService,
    private readonly actions: OrderActionsService,
  ) {}

  @Get()
  @Auth('admin')
  @ApiOperation({ summary: 'Live orders board data' })
  @ApiQuery({ name: 'state', required: false, enum: ORDER_STATES })
  @ApiQuery({ name: 'shopId', required: false })
  list(@Query('state') state?: OrderState, @Query('shopId') shopId?: string) {
    return this.orders.listForAdmin({ state, shopId });
  }

  @Get(':id')
  @Auth('admin')
  @ApiOperation({ summary: 'Full order detail incl. payments, refunds and audit trail' })
  get(@Param('id') id: string) {
    return this.orders.getForAdmin(id);
  }

  @Post(':id/assign-rider')
  @Auth('admin')
  @AdminRoles('OPS')
  @ApiOperation({ summary: 'Assign (or reassign) a rider to a packed order' })
  assignRider(@CurrentUser() user: JwtPayload, @Param('id') id: string, @Body() dto: AssignRiderDto) {
    return this.actions.adminAssignRider(user.sub, id, dto.riderId);
  }

  @Post(':id/transition')
  @Auth('admin')
  @AdminRoles('OPS')
  @ApiOperation({
    summary:
      'Ops manual override (phone-confirmed acceptance, forced cancel, etc.). Obeys the state machine; refunds/COD side effects apply automatically.',
  })
  transition(@CurrentUser() user: JwtPayload, @Param('id') id: string, @Body() dto: AdminTransitionDto) {
    return this.actions.adminTransition(user.sub, id, dto.toState, dto.note);
  }
}

@ApiTags('rider')
@Controller('rider')
export class RiderOrdersController {
  constructor(
    private readonly orders: OrdersService,
    private readonly actions: OrderActionsService,
    private readonly rider: RiderService,
  ) {}

  @Get('me')
  @Auth('rider')
  @ApiOperation({ summary: 'My rider profile: duty status, COD cash-in-hand and active task count' })
  me(@CurrentUser() user: JwtPayload) {
    return this.rider.me(user.sub);
  }

  @Post('duty')
  @Auth('rider')
  @ApiOperation({ summary: 'Go on/off duty. Only on-duty riders are offered new tasks.' })
  duty(@CurrentUser() user: JwtPayload, @Body() dto: DutyDto) {
    return this.rider.setDuty(user.sub, dto.onDuty);
  }

  @Post('location')
  @Auth('rider')
  @ApiOperation({ summary: 'Push my live GPS fix (foreground service pings this while on duty)' })
  location(@CurrentUser() user: JwtPayload, @Body() dto: RiderLocationDto) {
    return this.rider.recordLocation(user.sub, dto.lat, dto.lng);
  }

  @Get('tasks')
  @Auth('rider')
  @ApiOperation({ summary: 'My active delivery tasks (assigned → out for delivery)' })
  tasks(@CurrentUser() user: JwtPayload) {
    return this.orders.listRiderTasks(user.sub);
  }

  @Post('orders/:id/accept')
  @Auth('rider')
  @ApiOperation({ summary: 'Accept an offered task (first-accept-wins)' })
  accept(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.actions.riderAccept(user.sub, id);
  }

  @Post('orders/:id/pickup')
  @Auth('rider')
  @ApiOperation({ summary: 'Picked the parcel up from the shop' })
  pickup(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.actions.riderPickup(user.sub, id);
  }

  @Post('orders/:id/out-for-delivery')
  @Auth('rider')
  @ApiOperation({ summary: 'Heading to the customer' })
  outForDelivery(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.actions.riderOutForDelivery(user.sub, id);
  }

  @Post('orders/:id/deliver')
  @Auth('rider')
  @ApiOperation({ summary: 'Complete delivery — requires the 4-digit code from the customer app (COD: collects cash into your ledger)' })
  deliver(@CurrentUser() user: JwtPayload, @Param('id') id: string, @Body() dto: DeliverDto) {
    return this.actions.riderDeliver(user.sub, id, dto.otp);
  }

  @Post('orders/:id/undelivered')
  @Auth('rider')
  @ApiOperation({ summary: 'Delivery failed (customer unreachable etc.) — prepaid orders auto-refund' })
  undelivered(@CurrentUser() user: JwtPayload, @Param('id') id: string, @Body() dto: ReasonDto) {
    return this.actions.riderUndelivered(user.sub, id, dto.reason);
  }
}
