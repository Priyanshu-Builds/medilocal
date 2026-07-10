import { createHmac } from 'crypto';
import { verifyCheckoutSignature, verifyWebhookSignature } from './signature';

const WEBHOOK_SECRET = 'whsec_test_123';
const KEY_SECRET = 'rzp_key_secret_test';

function sign(body: string, secret: string): string {
  return createHmac('sha256', secret).update(body).digest('hex');
}

describe('Razorpay webhook signature', () => {
  const body = JSON.stringify({
    event: 'payment.captured',
    payload: { payment: { entity: { id: 'pay_123', order_id: 'order_456', amount: 12900 } } },
  });

  it('accepts a correctly signed raw body', () => {
    expect(verifyWebhookSignature(body, sign(body, WEBHOOK_SECRET), WEBHOOK_SECRET)).toBe(true);
    // and as a Buffer, which is what express rawBody actually hands us
    expect(verifyWebhookSignature(Buffer.from(body), sign(body, WEBHOOK_SECRET), WEBHOOK_SECRET)).toBe(true);
  });

  it('rejects a tampered body', () => {
    const tampered = body.replace('12900', '129');
    expect(verifyWebhookSignature(tampered, sign(body, WEBHOOK_SECRET), WEBHOOK_SECRET)).toBe(false);
  });

  it('rejects a signature made with the wrong secret', () => {
    expect(verifyWebhookSignature(body, sign(body, 'some-other-secret'), WEBHOOK_SECRET)).toBe(false);
  });

  it('rejects missing or malformed signatures', () => {
    expect(verifyWebhookSignature(body, undefined, WEBHOOK_SECRET)).toBe(false);
    expect(verifyWebhookSignature(body, '', WEBHOOK_SECRET)).toBe(false);
    expect(verifyWebhookSignature(body, 'not-hex-at-all!!', WEBHOOK_SECRET)).toBe(false);
    expect(verifyWebhookSignature(body, 'deadbeef', WEBHOOK_SECRET)).toBe(false); // wrong length
  });
});

describe('Razorpay checkout signature', () => {
  const orderId = 'order_Nxx123';
  const paymentId = 'pay_Nyy456';
  const good = sign(`${orderId}|${paymentId}`, KEY_SECRET);

  it('accepts the documented HMAC(order_id|payment_id) scheme', () => {
    expect(verifyCheckoutSignature(orderId, paymentId, good, KEY_SECRET)).toBe(true);
  });

  it('rejects swapped or foreign ids', () => {
    expect(verifyCheckoutSignature(paymentId, orderId, good, KEY_SECRET)).toBe(false);
    expect(verifyCheckoutSignature('order_other', paymentId, good, KEY_SECRET)).toBe(false);
  });

  it('rejects wrong secret and garbage signatures', () => {
    expect(verifyCheckoutSignature(orderId, paymentId, good, 'wrong')).toBe(false);
    expect(verifyCheckoutSignature(orderId, paymentId, 'zzzz', KEY_SECRET)).toBe(false);
  });
});
