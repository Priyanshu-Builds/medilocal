import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';

/**
 * One error shape for the whole API. HttpExceptions keep their status + message
 * (so the Flutter/dashboard clients still read `message`); anything unexpected
 * becomes a 500 with a generic message — the real error is logged (and picked
 * up by Sentry) but never leaked to the client in production.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('Exception');

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const req = ctx.getRequest<Request>();

    const isHttp = exception instanceof HttpException;
    const status = isHttp ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;

    // Preserve NestJS's body ({ statusCode, message, error }) for HttpExceptions.
    let body: Record<string, unknown>;
    if (isHttp) {
      const r = exception.getResponse();
      body = typeof r === 'string' ? { statusCode: status, message: r } : { ...(r as object) };
    } else {
      body = { statusCode: status, message: 'Internal server error', error: 'Internal Server Error' };
    }

    // Log server errors with the stack; client (4xx) errors stay quiet.
    if (status >= HttpStatus.INTERNAL_SERVER_ERROR) {
      const err = exception instanceof Error ? exception : new Error(String(exception));
      this.logger.error(`${req.method} ${req.originalUrl} → ${status}: ${err.message}`, err.stack);
    }

    res.status(status).json({
      ...body,
      timestamp: new Date().toISOString(),
      path: req.originalUrl,
    });
  }
}
