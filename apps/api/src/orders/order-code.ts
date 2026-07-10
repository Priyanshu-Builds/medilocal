import { randomInt } from 'crypto';
import { DELIVERY_OTP_LENGTH } from '@medilocal/shared';

/** Human-readable order code, e.g. ML-260710-0042 (per-day sequence). */
export function formatOrderCode(date: Date, seq: number): string {
  const yy = String(date.getFullYear() % 100).padStart(2, '0');
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `ML-${yy}${mm}${dd}-${String(seq).padStart(4, '0')}`;
}

/** Start of the local day, for counting today's orders when picking the next seq. */
export function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

/** Cryptographically random 4-digit handoff code (leading zeros allowed). */
export function generateDeliveryOtp(): string {
  return String(randomInt(0, 10 ** DELIVERY_OTP_LENGTH)).padStart(DELIVERY_OTP_LENGTH, '0');
}
