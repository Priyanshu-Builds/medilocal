import type { Prisma } from '@prisma/client';

/**
 * All money math happens in integer paise to dodge binary-float drift;
 * DB columns are DECIMAL(10,2) INR, API payloads are INR numbers.
 */
export function toPaise(value: Prisma.Decimal | number | string): number {
  return Math.round(Number(value) * 100);
}

export function toInr(paise: number): number {
  return Math.round(paise) / 100;
}
