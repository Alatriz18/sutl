import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import * as cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);
  const isProduction = config.get<string>('NODE_ENV') === 'production';

  // Cabeceras de seguridad (HSTS, no-sniff, sin X-Powered-By, CSP básica).
  // Swagger UI necesita <style>/<script> inline para renderizar, así que la
  // CSP por defecto de helmet la bloquea; por eso solo se relaja (y solo se
  // monta /api/docs) fuera de producción — en prod no queremos expuesta la
  // documentación de la API de todas formas.
  app.use(helmet(isProduction ? undefined : { contentSecurityPolicy: false }));
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

  if (!isProduction) {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('SUTL API')
      .setDescription('Sistema Universal de Tracking Logístico — API multi-tenant')
      .setVersion('1.0')
      .addBearerAuth()
      .build();
    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup('api/docs', app, document);
  }

  const port = config.get<number>('PORT') ?? 3001;
  await app.listen(port);
  // eslint-disable-next-line no-console
  console.log(`SUTL backend corriendo en http://localhost:${port}/api`);
  if (!isProduction) {
    // eslint-disable-next-line no-console
    console.log(`Documentación Swagger en http://localhost:${port}/api/docs`);
  }
}

bootstrap();
