import { createHmac } from 'crypto';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { RazorpayService } from '../src/payments/razorpay.service';

/**
 * The pre-pilot gate: one real order walked through the whole machine against a
 * live (seeded) Postgres. Razorpay's SDK is the only thing stubbed — every other
 * layer (auth, pricing, state machine, COD ledger, refunds, the M4 rider duty
 * gate) runs for real.
 *
 * Run with:  pnpm --filter @medilocal/api test:e2e
 * Requires:  a migrated + seeded DB and DEV_LOGIN_ENABLED=true.
 */

const WEBHOOK_SECRET = 'whsec_e2e';
const seededMedicineExpected = true;

// Deterministic Razorpay stand-in so the online-payment path is exercisable offline.
const fakeRazorpay: Partial<RazorpayService> = {
  enabled: true,
  keyId: 'rzp_test_e2e',
  keySecret: 'rzp_secret_e2e',
  webhookSecret: WEBHOOK_SECRET,
  createOrder: async (amountPaise: number, receipt: string) =>
    ({ id: `order_e2e_${receipt}_${Date.now()}`, amount: amountPaise, currency: 'INR' }) as any,
  refund: async (paymentId: string, amountPaise: number) =>
    ({ id: `rfnd_e2e_${Date.now()}`, amount: amountPaise, status: 'processed' }) as any,
};

function signWebhook(rawBody: string): string {
  return createHmac('sha256', WEBHOOK_SECRET).update(rawBody).digest('hex');
}

describe('Staging E2E — full order lifecycle', () => {
  let app: INestApplication;
  let http: ReturnType<typeof request>;

  // shared fixtures discovered from the seed
  let customerToken: string;
  let shopToken: string;
  let adminToken: string;
  let riderToken: string;
  let riderId: string;
  let otcMedicineId: string;
  let addressId: string;

  const login = {
    customer: () =>
      request(app.getHttpServer())
        .post('/v1/auth/dev/login')
        .send({ kind: 'customer', phone: '9990009001' }),
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(RazorpayService)
      .useValue(fakeRazorpay)
      .compile();

    app = moduleRef.createNestApplication({ rawBody: true });
    app.setGlobalPrefix('v1', { exclude: ['health'] });
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
    http = request(app.getHttpServer());

    // Customer + an OTC medicine + a delivery address
    const c = await http.post('/v1/auth/dev/login').send({ kind: 'customer', phone: '9990009001' });
    expect(c.status).toBe(201);
    customerToken = c.body.accessToken;

    const meds = await http.get('/v1/catalog/medicines?zoneId=seed-zone');
    expect(meds.status).toBe(200);
    const otc = (meds.body as any[]).find((m) => !m.rxRequired);
    expect(otc).toBeDefined();
    otcMedicineId = otc.id;

    const addr = await http
      .post('/v1/me/addresses')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ zoneId: 'seed-zone', label: 'Home', line1: '7 E2E Street', lat: 25.594, lng: 85.137 });
    expect(addr.status).toBe(201);
    addressId = addr.body.id;

    // Staff logins (from seed)
    const s = await http
      .post('/v1/auth/shop/login')
      .send({ email: 'pharmacy@medilocal.local', password: 'ChangeMe123!' });
    expect(s.status).toBe(201);
    shopToken = s.body.accessToken;

    const a = await http
      .post('/v1/auth/admin/login')
      .send({ email: 'admin@medilocal.local', password: 'ChangeMe123!' });
    expect(a.status).toBe(201);
    adminToken = a.body.accessToken;

    const r = await http.post('/v1/auth/dev/login').send({ kind: 'rider', phone: '9800000003' });
    expect(r.status).toBe(201);
    riderToken = r.body.accessToken;
    riderId = r.body.user.id;
  });

  afterAll(async () => {
    await app?.close();
  });

  const auth = (t: string) => ({ Authorization: `Bearer ${t}` });

  async function placeOrder(paymentMethod: 'COD' | 'RAZORPAY') {
    const res = await http
      .post('/v1/orders')
      .set(auth(customerToken))
      .send({ addressId, paymentMethod, items: [{ medicineId: otcMedicineId, qty: 1 }] });
    expect(res.status).toBe(201);
    return res.body;
  }

  async function shopAcceptAndPack(orderId: string) {
    const detail = await http.get(`/v1/shop/orders/${orderId}`).set(auth(shopToken));
    expect(detail.status).toBe(200);
    const decisions = detail.body.items.map((i: any) => ({ orderItemId: i.id, accepted: true }));
    expect((await http.post(`/v1/shop/orders/${orderId}/accept`).set(auth(shopToken)).send({ items: decisions })).status).toBe(201);
    expect((await http.post(`/v1/shop/orders/${orderId}/pack`).set(auth(shopToken))).status).toBe(201);
  }

  it('sanity: seed data is present', () => {
    expect(seededMedicineExpected && otcMedicineId).toBeTruthy();
  });

  it('COD happy path: order → accept → pack → assign → rider deliver → COD ledger', async () => {
    const { order } = await placeOrder('COD');
    expect(order.state).toBe('PLACED');
    expect(order.paymentState).toBe('COD_DUE');
    const orderId = order.id;
    const total = Number(order.grandTotalInr);

    await shopAcceptAndPack(orderId);

    // Rider must be ON DUTY before admin can assign (M4 rule)
    await http.post('/v1/rider/duty').set(auth(riderToken)).send({ onDuty: true }).expect(201);
    const before = await http.get('/v1/rider/me').set(auth(riderToken));
    const cashBefore = Number(before.body.cashInHandInr);

    await http.post(`/v1/admin/orders/${orderId}/assign-rider`).set(auth(adminToken)).send({ riderId }).expect(201);
    await http.post(`/v1/rider/orders/${orderId}/accept`).set(auth(riderToken)).expect(201);
    await http.post(`/v1/rider/orders/${orderId}/pickup`).set(auth(riderToken)).expect(201);
    await http.post(`/v1/rider/orders/${orderId}/out-for-delivery`).set(auth(riderToken)).expect(201);

    // Delivery OTP is the customer's to share
    const custView = await http.get(`/v1/orders/${orderId}`).set(auth(customerToken));
    const otp = custView.body.deliveryOtp;
    expect(otp).toMatch(/^\d{4}$/);

    // Wrong code is rejected; correct code delivers + collects COD
    await http.post(`/v1/rider/orders/${orderId}/deliver`).set(auth(riderToken)).send({ otp: otp === '0000' ? '1111' : '0000' }).expect(400);
    await http.post(`/v1/rider/orders/${orderId}/deliver`).set(auth(riderToken)).send({ otp }).expect(201);

    const final = await http.get(`/v1/orders/${orderId}`).set(auth(customerToken));
    expect(final.body.state).toBe('DELIVERED');
    expect(final.body.paymentState).toBe('COD_COLLECTED');

    const after = await http.get('/v1/rider/me').set(auth(riderToken));
    expect(Number(after.body.cashInHandInr)).toBeCloseTo(cashBefore + total, 2);
  });

  it('Razorpay path: order stays PENDING until a SIGNED payment.captured webhook lands', async () => {
    const res = await placeOrder('RAZORPAY');
    const orderId = res.order.id;
    expect(res.order.paymentState).toBe('PENDING');
    expect(res.razorpayCheckout?.razorpayOrderId).toMatch(/^order_e2e_/);
    const rzpOrderId = res.razorpayCheckout.razorpayOrderId;
    const amountPaise = res.razorpayCheckout.amountPaise;

    // Unpaid order is invisible to the shop
    const hidden = await http.get(`/v1/shop/orders/${orderId}`).set(auth(shopToken));
    expect(hidden.status).toBe(404);

    // A tampered/unsigned webhook is rejected
    const payload = JSON.stringify({
      event: 'payment.captured',
      payload: { payment: { entity: { order_id: rzpOrderId, id: 'pay_e2e_1', amount: amountPaise } } },
    });
    await http.post('/v1/payments/razorpay/webhook').set('Content-Type', 'application/json').set('x-razorpay-signature', 'deadbeef').send(payload).expect(400);

    // Correctly signed webhook confirms the payment
    await http
      .post('/v1/payments/razorpay/webhook')
      .set('Content-Type', 'application/json')
      .set('x-razorpay-signature', signWebhook(payload))
      .send(payload)
      .expect(200);

    const paid = await http.get(`/v1/orders/${orderId}`).set(auth(customerToken));
    expect(paid.body.paymentState).toBe('PAID');
    // Now visible to the shop
    expect((await http.get(`/v1/shop/orders/${orderId}`).set(auth(shopToken))).status).toBe(200);
  });

  it('Refund path: cancelling a PAID order refunds it', async () => {
    const res = await placeOrder('RAZORPAY');
    const orderId = res.order.id;
    const rzpOrderId = res.razorpayCheckout.razorpayOrderId;
    const amountPaise = res.razorpayCheckout.amountPaise;

    const payload = JSON.stringify({
      event: 'payment.captured',
      payload: { payment: { entity: { order_id: rzpOrderId, id: 'pay_e2e_2', amount: amountPaise } } },
    });
    await http.post('/v1/payments/razorpay/webhook').set('Content-Type', 'application/json').set('x-razorpay-signature', signWebhook(payload)).send(payload).expect(200);

    // Customer cancels while still cancellable → auto-refund
    await http.post(`/v1/orders/${orderId}/cancel`).set(auth(customerToken)).send({ reason: 'e2e refund check' }).expect(201);

    const cancelled = await http.get(`/v1/orders/${orderId}`).set(auth(customerToken));
    expect(cancelled.body.state).toBe('CANCELLED');
    expect(cancelled.body.paymentState).toBe('REFUNDED');
  });
});
