import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { TenantsModule } from './modules/tenants/tenants.module';
import { ShipmentsModule } from './modules/shipments/shipments.module';
import { TrackingEventsModule } from './modules/tracking-events/tracking-events.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    AuthModule,
    UsersModule,
    TenantsModule,
    ShipmentsModule,
    TrackingEventsModule,
  ],
})
export class AppModule {}
