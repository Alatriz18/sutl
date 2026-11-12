import { DynamicModule, Global, Module } from '@nestjs/common';
import { CANAL_EMAIL, CANAL_WHATSAPP } from './channels/channel';
import { EmailChannel } from './channels/email.channel';
import { WhatsAppChannel } from './channels/whatsapp.channel';
import { NotificationsController } from './notifications.controller';
import { NotificationsProcessor } from './notifications.processor';
import { NotificationsService } from './notifications.service';

// El procesador solo existe si hay Redis (si no, no hay cola de la que leer y
// el servicio envía en el momento).
@Global() // otros módulos (p. ej. el monitor de riesgo) envían avisos sin importarlo
@Module({})
export class NotificationsModule {
  static forRoot(): DynamicModule {
    return {
      module: NotificationsModule,
      controllers: [NotificationsController],
      providers: [
        { provide: CANAL_EMAIL, useClass: EmailChannel },
        { provide: CANAL_WHATSAPP, useClass: WhatsAppChannel },
        NotificationsService,
        ...(process.env.REDIS_URL ? [NotificationsProcessor] : []),
      ],
      exports: [NotificationsService, CANAL_EMAIL],
    };
  }
}
