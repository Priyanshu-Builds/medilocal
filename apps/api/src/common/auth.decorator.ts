import { SetMetadata, UseGuards, applyDecorators } from '@nestjs/common';
import { ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from './roles.guard';
import type { AdminRole } from '@medilocal/shared';
import type { TokenKind } from './jwt-payload';

export const AUTH_KINDS_KEY = 'auth_kinds';
export const ADMIN_ROLES_KEY = 'admin_roles';

/**
 * Require a valid bearer token of one of the given kinds, e.g.
 * @Auth('customer') or @Auth('admin', 'shop'). No kinds = any valid token.
 */
export function Auth(...kinds: TokenKind[]) {
  return applyDecorators(
    SetMetadata(AUTH_KINDS_KEY, kinds),
    UseGuards(JwtAuthGuard, RolesGuard),
    ApiBearerAuth(),
  );
}

/**
 * Further restrict an @Auth('admin') endpoint to specific admin roles.
 * SUPER_ADMIN always passes.
 */
export function AdminRoles(...roles: AdminRole[]) {
  return SetMetadata(ADMIN_ROLES_KEY, roles);
}
