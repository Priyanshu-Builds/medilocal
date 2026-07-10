/**
 * Writes the OpenAPI spec to apps/api/openapi.json WITHOUT starting the
 * server or touching the database (module lifecycle hooks never run).
 * CI regenerates it and fails on drift; the Dart client is generated from it.
 *
 *   pnpm --filter @medilocal/api openapi:export
 */
import { NestFactory } from '@nestjs/core';
import { SwaggerModule } from '@nestjs/swagger';
import { writeFileSync } from 'fs';
import { join } from 'path';
import { AppModule } from '../src/app.module';
import { buildSwaggerConfig } from '../src/openapi';

async function main() {
  const app = await NestFactory.create(AppModule, { logger: false, abortOnError: false });
  app.setGlobalPrefix('v1', { exclude: ['health'] }); // must match main.ts
  const document = SwaggerModule.createDocument(app, buildSwaggerConfig());
  const outPath = join(__dirname, '..', 'openapi.json');
  writeFileSync(outPath, JSON.stringify(document, null, 2) + '\n');
  console.log(`OpenAPI spec written to ${outPath} (${Object.keys(document.paths).length} paths)`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
