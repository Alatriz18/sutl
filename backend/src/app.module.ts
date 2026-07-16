import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { MongooseModule } from '@nestjs/mongoose';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { TenantsModule } from './modules/tenants/tenants.module';
import { ShipmentsModule } from './modules/shipments/shipments.module';
import { TrackingEventsModule } from './modules/tracking-events/tracking-events.module';
import { CarriersModule } from './modules/carriers/carriers.module';
import { PrismaModule } from './prisma/prisma.module';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { RolesGuard } from './common/guards/roles.guard';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    MongooseModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        uri: config.get<string>('MONGO_URI'),
        // Mongo puede tardar en estar listo en dev local (ej. primer `docker
        // compose up` descargando la imagen); reintenta bastante antes de
        // tumbar el bootstrap en vez de fallar rápido.
        retryAttempts: 100,
        retryDelay: 3000,
      }),
    }),
    PrismaModule,
    AuthModule,
    UsersModule,
    TenantsModule,
    ShipmentsModule,
    TrackingEventsModule,
    CarriersModule,
  ],
  providers: [
    // Guard global: toda ruta exige JWT salvo @Public(). RolesGuard corre
    // después y solo restringe si el handler tiene @Roles(...).
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    { provide: APP_FILTER, useClass: HttpExceptionFilter },
  ],
})
export class AppModule {}
