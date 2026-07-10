import { Module } from '@nestjs/common';
import { OrdersModule } from '../orders/orders.module';
import { StorageModule } from '../storage/storage.module';
import {
  AdminPrescriptionsController,
  PrescriptionsController,
  ShopPrescriptionsController,
} from './prescriptions.controller';
import { PrescriptionsService } from './prescriptions.service';

@Module({
  imports: [StorageModule, OrdersModule],
  controllers: [PrescriptionsController, AdminPrescriptionsController, ShopPrescriptionsController],
  providers: [PrescriptionsService],
})
export class PrescriptionsModule {}
