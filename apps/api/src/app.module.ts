import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from './auth/auth.module';
import { CartModule } from './cart/cart.module';
import { CatalogModule } from './catalog/catalog.module';
import { FirebaseModule } from './firebase/firebase.module';
import { HealthController } from './health.controller';
import { NotificationsModule } from './notifications/notifications.module';
import { OrdersModule } from './orders/orders.module';
import { PaymentsModule } from './payments/payments.module';
import { PrescriptionsModule } from './prescriptions/prescriptions.module';
import { PrismaModule } from './prisma/prisma.module';
import { ShopsModule } from './shops/shops.module';
import { StorageModule } from './storage/storage.module';
import { UsersModule } from './users/users.module';
import { ZonesModule } from './zones/zones.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    FirebaseModule,
    AuthModule,
    ZonesModule,
    UsersModule,
    CatalogModule,
    ShopsModule,
    CartModule,
    StorageModule,
    NotificationsModule,
    PaymentsModule,
    OrdersModule,
    PrescriptionsModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
