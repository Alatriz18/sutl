import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { AppModule } from '../src/app.module';

// Levanta la app completa (mismo bootstrap que main.ts) contra la base real
// de Docker Compose (Postgres + Mongo locales) para las pruebas e2e. No usa
// mocks: valida el comportamiento real de guards, validación y Prisma.
export async function createTestApp(): Promise<INestApplication> {
  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  const app = moduleRef.createNestApplication();
  app.use(helmet());
  app.use(cookieParser());
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }),
  );
  app.setGlobalPrefix('api');
  await app.init();
  return app;
}
