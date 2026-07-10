import { ExecutionContext, createParamDecorator } from '@nestjs/common';
import type { JwtPayload } from './jwt-payload';

/** Injects the verified JWT payload attached by JwtAuthGuard. */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): JwtPayload => ctx.switchToHttp().getRequest().user,
);
