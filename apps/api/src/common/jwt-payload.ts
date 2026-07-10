/** Who a bearer token belongs to. Backend-issued JWTs carry one of these kinds. */
export type TokenKind = 'admin' | 'shop' | 'customer' | 'rider';

export interface JwtPayload {
  sub: string;
  kind: TokenKind;
  /** AdminRole — present only for kind 'admin'. */
  role?: string;
  /** Present only for kind 'shop'. */
  shopId?: string;
}
