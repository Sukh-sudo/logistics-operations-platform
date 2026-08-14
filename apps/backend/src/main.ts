import './load-environment';
import { NestFactory } from '@nestjs/core';

// Swagger imports
import {
  SwaggerModule,
  DocumentBuilder,
} from '@nestjs/swagger';

import { AppModule } from './app.module';

// Import Prisma exception filter
import { configureApplication } from './configure-application';
import { logApplicationEvent } from './common/utils/logger';
import { accessTokenSecret } from './modules/auth/auth.constants';

async function bootstrap() {
  // Fail during startup in every environment; an accidental NODE_ENV value
  // must never activate a known signing key.
  accessTokenSecret();
  const app = await NestFactory.create(AppModule);

  app.enableCors({
    origin: (process.env.CORS_ORIGINS ?? 'http://localhost:5173,http://127.0.0.1:5173')
      .split(',')
      .map((origin) => origin.trim()),
    credentials: true,
  });

  configureApplication(app);

  // Configure Swagger documentation
  const config = new DocumentBuilder()
    .setTitle('Logistics Operations Platform')
    .setDescription('Operational event management APIs')
    .setVersion('1.0')
    .build();

  // Generate Swagger document
  const document = SwaggerModule.createDocument(app, config);

  // Expose Swagger UI
  SwaggerModule.setup('api/docs', app, document);

  await app.listen(process.env.PORT ?? 3000);

  logApplicationEvent('log', 'Bootstrap', 'Application started', {
    port: process.env.PORT ?? 3000,
    swaggerPath: '/api/docs',
  });
}

bootstrap();
