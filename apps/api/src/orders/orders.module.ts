import { Module } from '@nestjs/common';
import { CartModule } from '../cart/cart.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { PaymentsModule } from '../payments/payments.module';
import { OrderActionsService } from './order-actions.service';
import {
  AdminOrdersController,
  OrdersController,
  RiderOrdersController,
  ShopOrdersController,
} from './orders.controller';
import { OrdersService } from './orders.service';
import { RiderService } from './rider.service';

@Module({
  imports: [CartModule, PaymentsModule, NotificationsModule],
  controllers: [OrdersController, ShopOrdersController, AdminOrdersController, RiderOrdersController],
  providers: [OrdersService, OrderActionsService, RiderService],
  exports: [OrdersService, OrderActionsService],
})
export class OrdersModule {}
