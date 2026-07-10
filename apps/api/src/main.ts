import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { buildSwaggerConfig } from './openapi';

async function bootstrap() {
  // rawBody: Razorpay webhook signatures are HMACs over the raw request bytes.
  const app = await NestFactory.create(AppModule, { rawBody: true });

  app.setGlobalPrefix('v1', { exclude: ['health'] });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.enableCors({
    origin: (process.env.CORS_ORIGINS ?? 'http://localhost:3001,http://localhost:3002').split(','),
    credentials: true,
  });

  SwaggerModule.setup('docs', app, SwaggerModule.createDocument(app, buildSwaggerConfig()));

  const port = Number(process.env.PORT ?? 3000);
  await app.listen(port);
  console.log(`API ready → http://localhost:${port}  (Swagger → http://localhost:${port}/docs)`);
}

bootstrap();
