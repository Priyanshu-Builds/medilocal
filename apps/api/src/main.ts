import './instrument'; // must be first — initializes Sentry before anything else loads
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { buildSwaggerConfig } from './openapi';

async function bootstrap() {
  // rawBody: Razorpay webhook signatures are HMACs over the raw request bytes.
  const app = await NestFactory.create(AppModule, { rawBody: true });
  const isProd = process.env.NODE_ENV === 'production';

  // Security headers. Swagger UI needs a relaxed CSP, so disable that one directive.
  app.use(helmet({ contentSecurityPolicy: false }));
  // Behind Nginx in prod: trust the proxy so rate-limiting sees the real client IP.
  app.getHttpAdapter().getInstance().set('trust proxy', 1);

  app.setGlobalPrefix('v1', { exclude: ['health'] });
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: false }),
  );
  app.enableCors({
    origin: (process.env.CORS_ORIGINS ?? 'http://localhost:3001,http://localhost:3002').split(','),
    credentials: true,
  });

  // Flush DB/Redis connections and in-flight work on SIGTERM/SIGINT.
  app.enableShutdownHooks();

  // Swagger stays on in non-prod; lock it behind a flag for production.
  if (!isProd || process.env.ENABLE_SWAGGER === 'true') {
    SwaggerModule.setup('docs', app, SwaggerModule.createDocument(app, buildSwaggerConfig()));
  }

  const port = Number(process.env.PORT ?? 3000);
  await app.listen(port);
  console.log(`API ready → http://localhost:${port}  (Swagger → http://localhost:${port}/docs)`);
}

bootstrap();
