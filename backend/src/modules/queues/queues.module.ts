import { BullModule } from '@nestjs/bullmq';
import { DynamicModule, Logger, Module } from '@nestjs/common';
import { COLA_MANTENIMIENTO } from './queues.constants';
import { QueuesController } from './queues.controller';
import { QueuesService } from './queues.service';
import { MantenimientoProcessor } from './mantenimiento.processor';

// Las colas viven en Redis (BullMQ). Si REDIS_URL no está definida, el módulo
// se registra sin colas: la API sigue funcionando y /queues/estado informa
// "deshabilitado". Así un entorno sin Redis no se cae por una función auxiliar.
@Module({})
export class QueuesModule {
  static forRoot(): DynamicModule {
    const redisUrl = process.env.REDIS_URL;
    if (!redisUrl) {
      new Logger('QueuesModule').warn(
        'REDIS_URL no está definida: las colas de trabajo quedan deshabilitadas.',
      );
      return {
        module: QueuesModule,
        controllers: [QueuesController],
        providers: [QueuesService],
      };
    }
    return {
      module: QueuesModule,
      imports: [
        BullModule.forRoot({
          // BullMQ acepta la URL completa; las credenciales van en REDIS_URL.
          connection: { url: redisUrl, maxRetriesPerRequest: null },
          // Las pruebas usan otro prefijo: así vaciar la cola de pruebas no
          // toca los trabajos ni los programadores del entorno de desarrollo.
          prefix: process.env.NODE_ENV === 'test' ? 'sutl-test' : 'sutl',
        }),
        BullModule.registerQueue({
          name: COLA_MANTENIMIENTO,
          defaultJobOptions: {
            removeOnComplete: 20,
            removeOnFail: 50,
            attempts: 3,
            backoff: { type: 'exponential', delay: 2000 },
          },
        }),
      ],
      controllers: [QueuesController],
      providers: [QueuesService, MantenimientoProcessor],
      exports: [QueuesService],
    };
  }
}
