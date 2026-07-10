import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.setGlobalPrefix('v1', { exclude: ['health'] });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.enableCors({
    origin: (process.env.CORS_ORIGINS ?? 'http://localhost:3001,http://localhost:3002').split(','),
    credentials: true,
  });

  const swaggerConfig = new DocumentBuilder()
    .setTitle('MediLocal API')
    .setDescription(
      'Hyperlocal medicine delivery platform API. The OpenAPI spec at /docs-json also feeds the Dart client generator for the Flutter apps.',
    )
    .setVersion('0.1.0')
    .addBearerAuth()
    .build();
  SwaggerModule.setup('docs', app, SwaggerModule.createDocument(app, swaggerConfig));

  const port = Number(process.env.PORT ?? 3000);
  await app.listen(port);
  console.log(`API ready → http://localhost:${port}  (Swagger → http://localhost:${port}/docs)`);
}

bootstrap();
