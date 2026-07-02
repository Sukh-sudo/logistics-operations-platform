import { NestFactory } from '@nestjs/core';
import {ValidationPipe,} from '@nestjs/common';

// Swagger imports
import {
  SwaggerModule,
  DocumentBuilder,
} from '@nestjs/swagger';

import { AppModule } from './app.module';

// Import Prisma exception filter
import { PrismaExceptionFilter } from './common/filters/prisma-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.enableCors({
    origin: (process.env.CORS_ORIGINS ?? 'http://localhost:5173,http://127.0.0.1:5173')
      .split(',')
      .map((origin) => origin.trim()),
    credentials: true,
  });

  // Enable global DTO validation
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );


  // Register global Prisma exception handling
  app.useGlobalFilters(
    new PrismaExceptionFilter(),
  );

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

   console.log(
    `Application running on: http://localhost:${process.env.PORT ?? 3000}`,
  );

  console.log(
    `Swagger docs: http://localhost:${process.env.PORT ?? 3000}/api/docs`,
  );
}

bootstrap();
