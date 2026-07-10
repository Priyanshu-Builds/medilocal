import { createHmac, timingSafeEqual } from 'crypto';

/** Pure signature helpers, unit-tested with known vectors (no SDK involved). */

function safeEqualHex(aHex: string, bHex: string): boolean {
  const a = Buffer.from(aHex, 'hex');
  const b = Buffer.from(bHex, 'hex');
  return a.length === b.length && a.length > 0 && timingSafeEqual(a, b);
}

/**
 * Razorpay webhook: X-Razorpay-Signature = HMAC-SHA256(raw request body, webhook secret), hex.
 * Must be computed over the RAW body bytes — any re-serialization breaks it.
 */
export function verifyWebhookSignature(
  rawBody: Buffer | string,
  signature: string | undefined,
  webhookSecret: string,
): boolean {
  if (!signature) return false;
  const expected = createHmac('sha256', webhookSecret).update(rawBody).digest('hex');
  try {
    return safeEqualHex(expected, signature);
  } catch {
    return false; // signature wasn't valid hex
  }
}

/**
 * Razorpay Checkout handler signature:
 * razorpay_signature = HMAC-SHA256(`${order_id}|${payment_id}`, key secret), hex.
 */
export function verifyCheckoutSignature(
  razorpayOrderId: string,
  razorpayPaymentId: string,
  signature: string,
  keySecret: string,
): boolean {
  const expected = createHmac('sha256', keySecret)
    .update(`${razorpayOrderId}|${razorpayPaymentId}`)
    .digest('hex');
  try {
    return safeEqualHex(expected, signature);
  } catch {
    return false;
  }
}
