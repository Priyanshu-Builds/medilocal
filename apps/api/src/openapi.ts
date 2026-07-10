import { DocumentBuilder } from '@nestjs/swagger';

/**
 * Shared between the running server (main.ts) and scripts/export-openapi.ts
 * so the committed spec can never drift from what /docs serves.
 */
export function buildSwaggerConfig() {
  return new DocumentBuilder()
    .setTitle('MediLocal API')
    .setDescription(
      'Hyperlocal medicine delivery platform API. The OpenAPI spec at /docs-json also feeds the Dart client generator for the Flutter apps.',
    )
    .setVersion('0.1.0')
    .addBearerAuth()
    .build();
}
