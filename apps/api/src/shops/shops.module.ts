import { Module } from '@nestjs/common';
import { AdminShopsController, ShopInventoryController, ShopsController } from './shops.controller';
import { ShopsService } from './shops.service';

@Module({
  controllers: [ShopsController, ShopInventoryController, AdminShopsController],
  providers: [ShopsService],
  exports: [ShopsService],
})
export class ShopsModule {}
