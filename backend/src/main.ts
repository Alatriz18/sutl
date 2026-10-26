import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);

  // Cabeceras de seguridad (HSTS, no-sniff, sin X-Powered-By, CSP básica).
  // disable: false por defecto en helmet ya cubre lo esencial de OWASP; la
  // API no sirve HTML propio así que una CSP estricta no rompe nada aquí.
  app.use(helmet());
  app.use(cookieParser());

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  app.enableCors({
    origin: config.get<string>('FRONTEND_URL') ?? 'http://localhost:3000',
    credentials: true,
  });

  app.setGlobalPrefix('api');

  const port = config.get<number>('PORT') ?? 3001;
  await app.listen(port);
  // eslint-disable-next-line no-console
  console.log(`SUTL backend corriendo en http://localhost:${port}/api`);
}

bootstrap();
