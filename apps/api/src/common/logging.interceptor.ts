import { CallHandler, ExecutionContext, Injectable, Logger, NestInterceptor } from '@nestjs/common';
import { Observable, tap } from 'rxjs';
import type { Request, Response } from 'express';

/** One line per request: method, path, status, duration. Skips the noisy health poll. */
@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const http = context.switchToHttp();
    const req = http.getRequest<Request>();
    if (req.originalUrl === '/health') return next.handle();

    const started = Date.now();
    return next.handle().pipe(
      tap(() => {
        const res = http.getResponse<Response>();
        this.logger.log(`${req.method} ${req.originalUrl} ${res.statusCode} ${Date.now() - started}ms`);
      }),
    );
  }
}
