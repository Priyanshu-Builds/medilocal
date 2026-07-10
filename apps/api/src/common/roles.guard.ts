import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ADMIN_ROLES_KEY, AUTH_KINDS_KEY } from './auth.decorator';
import type { JwtPayload, TokenKind } from './jwt-payload';

/**
 * Enforces the token-kind (customer/shop/rider/admin) declared via @Auth()
 * and, for admins, the optional role list declared via @AdminRoles().
 * Runs after JwtAuthGuard, which attaches the verified payload to request.user.
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const kinds = this.reflector.getAllAndOverride<TokenKind[] | undefined>(AUTH_KINDS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    const user: JwtPayload | undefined = context.switchToHttp().getRequest().user;
    if (!user) throw new ForbiddenException();

    if (kinds && kinds.length > 0 && !kinds.includes(user.kind)) {
      throw new ForbiddenException(`This endpoint is for ${kinds.join('/')} accounts`);
    }

    const adminRoles = this.reflector.getAllAndOverride<string[] | undefined>(ADMIN_ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (user.kind === 'admin' && adminRoles && adminRoles.length > 0) {
      // SUPER_ADMIN passes every role gate.
      if (user.role !== 'SUPER_ADMIN' && !adminRoles.includes(user.role ?? '')) {
        throw new ForbiddenException(`Requires admin role: ${adminRoles.join('/')}`);
      }
    }
    return true;
  }
}
