import { DynamicModule, Global, Module } from '@nestjs/common';
import { WebhooksController } from './webhooks.controller';
import { WebhooksProcessor } from './webhooks.processor';
import { WebhooksService } from './webhooks.service';

// Global: shipments y purchase-orders publican eventos sin importar este módulo.
// El procesador solo existe si hay Redis; sin él, el servicio entrega en el momento.
@Global()
@Module({})
export class WebhooksModule {
  static forRoot(): DynamicModule {
    return {
      module: WebhooksModule,
      controllers: [WebhooksController],
      providers: [WebhooksService, ...(process.env.REDIS_URL ? [WebhooksProcessor] : [])],
      exports: [WebhooksService],
    };
  }
}
