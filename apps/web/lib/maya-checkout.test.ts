/**
 * 💳 Maya Checkout — the rules (owner 2026-11-21, DECISION_LOG "MAYA CHECKOUT — BUILD IT").
 *
 *   · the rail is ON only with the switch AND both keys; otherwise it says why;
 *   · the checkout asks for the order total EXACTLY — one line, no fee, no surcharge;
 *   · only PAYMENT_SUCCESS + PHP + our exact reference + the exact amount is "paid";
 *   · the API calls use the right key, the right path and Basic `key:` auth (fetch mocked).
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  judgeMayaPayment,
  judgeMayaPayments,
  mayaApiBase,
  mayaBasicAuth,
  mayaCheckoutBody,
  mayaEnvironment,
  mayaRailReasonLine,
  mayaRailState,
  mayaReturnLine,
} from '@/lib/maya-checkout';
import {
  createMayaCheckout,
  fetchMayaPayment,
  fetchMayaPaymentsByReference,
  registerMayaWebhooks,
} from '@/lib/maya-api';

const SANDBOX = 'https://pg-sandbox.paymaya.com/checkout/v1/checkouts';
const config = { publicKey: 'pk-test', secretKey: 'sk-test', checkoutEndpoint: SANDBOX };
const expected = { reference: 'SN12345678', amountPhp: 1499.5 };
const paid = { id: 'pay-1', status: 'PAYMENT_SUCCESS', isPaid: true, amount: 1499.5, currency: 'PHP', requestReferenceNumber: 'SN12345678' };

type Call = { url: string; method: string; auth: string | null; body: unknown };
function mockFetch(answers: Array<{ status: number; json?: unknown }>) {
  const calls: Call[] = [];
  const impl = (async (url: string | URL, init?: RequestInit) => {
    const headers = (init?.headers ?? {}) as Record<string, string>;
    calls.push({
      url: String(url),
      method: init?.method ?? 'GET',
      auth: headers.Authorization ?? null,
      body: init?.body ? JSON.parse(String(init.body)) : undefined,
    });
    const a = answers.shift() ?? { status: 500 };
    return new Response(a.json === undefined ? '' : JSON.stringify(a.json), { status: a.status });
  }) as typeof fetch;
  return { impl, calls };
}

test('the API base is the saved endpoint\'s origin; sandbox is read from the host', () => {
  assert.equal(mayaApiBase(SANDBOX), 'https://pg-sandbox.paymaya.com');
  assert.equal(mayaApiBase('https://pg.maya.ph/checkout/v1/checkouts'), 'https://pg.maya.ph');
  assert.equal(mayaApiBase('not a url'), null);
  assert.equal(mayaEnvironment(SANDBOX), 'sandbox');
  assert.equal(mayaEnvironment('https://pg.maya.ph/checkout/v1/checkouts'), 'production');
});

test('Basic auth is the key with an empty password', () => {
  assert.equal(mayaBasicAuth('pk-test'), `Basic ${Buffer.from('pk-test:').toString('base64')}`);
});

test('the rail is on only with the switch AND both keys — and says which is missing', () => {
  assert.deepEqual(mayaRailState({ enabled: false, publicKey: 'p', secretKey: 's' }), { open: false, reason: 'off' });
  assert.deepEqual(mayaRailState({ enabled: true, publicKey: '', secretKey: 's' }), { open: false, reason: 'missing_public_key' });
  assert.deepEqual(mayaRailState({ enabled: true, publicKey: 'p', secretKey: ' ' }), { open: false, reason: 'missing_secret_key' });
  assert.deepEqual(mayaRailState({ enabled: true, publicKey: '', secretKey: '' }), { open: false, reason: 'missing_both_keys' });
  assert.deepEqual(mayaRailState({ enabled: true, publicKey: 'p', secretKey: 's' }), { open: true });
  assert.equal(mayaRailReasonLine('off'), null);
  assert.match(mayaRailReasonLine('missing_secret_key') ?? '', /secret key/);
});

test('the checkout asks for the order total exactly — one line, no fee, no surcharge', () => {
  const body = mayaCheckoutBody({ amountPhp: 1499.5, reference: 'SN12345678', description: 'Event Hub Pro', origin: 'https://www.setnayan.com/' });
  assert.deepEqual(body.totalAmount, { value: '1499.50', currency: 'PHP' });
  assert.equal(body.requestReferenceNumber, 'SN12345678');
  const items = body.items as Array<{ name: string; totalAmount: { value: string } }>;
  assert.equal(items.length, 1, 'one line only — a second line would be a fee');
  assert.equal(items[0]!.totalAmount.value, '1499.50');
  assert.deepEqual(body.redirectUrl, {
    success: 'https://www.setnayan.com/pay/SN12345678?maya=success',
    failure: 'https://www.setnayan.com/pay/SN12345678?maya=failure',
    cancel: 'https://www.setnayan.com/pay/SN12345678?maya=cancel',
  });
  assert.doesNotMatch(JSON.stringify(body), /fee|surcharge|serviceCharge/i);
});

test('only PAYMENT_SUCCESS + PHP + our reference + the exact amount is "paid"', () => {
  assert.deepEqual(judgeMayaPayment(paid, expected), { kind: 'paid', mayaPaymentId: 'pay-1', amountPhp: 1499.5 });
  const kinds = (p: object) => judgeMayaPayment({ ...paid, ...p }, expected).kind;
  assert.equal(kinds({ amount: 1499.49 }), 'mismatch', 'a centavo short is not paid');
  assert.equal(kinds({ amount: '1499.50' }), 'paid', 'a string amount is read');
  assert.equal(kinds({ currency: 'USD' }), 'mismatch');
  assert.equal(kinds({ requestReferenceNumber: 'SN99999999' }), 'mismatch');
  assert.equal(kinds({ isPaid: false }), 'mismatch');
  assert.equal(kinds({ id: undefined }), 'mismatch');
  assert.equal(kinds({ amount: undefined }), 'mismatch');
  assert.equal(kinds({ status: 'PAYMENT_PROCESSING' }), 'pending');
  assert.equal(kinds({ status: 'AUTHORIZED' }), 'pending', 'an authorisation is not a capture');
  assert.equal(kinds({ status: 'PAYMENT_EXPIRED' }), 'closed');
  assert.equal(kinds({ status: 'PAYMENT_FAILED' }), 'closed');
  assert.equal(kinds({ status: 'REFUNDED' }), 'closed');
});

test('among payments on one reference, a paid one wins, then a wrong one the admin must see', () => {
  const failed = { ...paid, id: 'pay-0', status: 'PAYMENT_FAILED' };
  assert.equal(judgeMayaPayments([failed, paid], expected).kind, 'paid');
  assert.equal(judgeMayaPayments([failed, { ...paid, amount: 1 }], expected).kind, 'mismatch');
  assert.equal(judgeMayaPayments([], expected).kind, 'pending');
});

test('the return lines are short and say nothing was charged', () => {
  assert.match(mayaReturnLine('failure') ?? '', /Nothing was charged/);
  assert.match(mayaReturnLine('cancel') ?? '', /Nothing was charged/);
  assert.equal(mayaReturnLine('success'), null);
});

test('create checkout: POST /checkout/v1/checkouts with the PUBLIC key', async () => {
  const { impl, calls } = mockFetch([{ status: 200, json: { checkoutId: 'chk-1', redirectUrl: 'https://payments-web-sandbox.paymaya.com/v2/checkout?id=chk-1' } }]);
  const res = await createMayaCheckout(config, { amountPhp: 1499.5, reference: 'SN12345678', description: 'Pro', origin: 'https://x.test' }, impl);
  assert.deepEqual(res, { ok: true, checkoutId: 'chk-1', redirectUrl: 'https://payments-web-sandbox.paymaya.com/v2/checkout?id=chk-1', environment: 'sandbox' });
  assert.equal(calls[0]!.url, 'https://pg-sandbox.paymaya.com/checkout/v1/checkouts');
  assert.equal(calls[0]!.method, 'POST');
  assert.equal(calls[0]!.auth, mayaBasicAuth('pk-test'));
});

test('create checkout: a refusal or a non-https redirect sends nobody anywhere', async () => {
  assert.deepEqual(await createMayaCheckout(config, { amountPhp: 1, reference: 'R', description: 'd', origin: 'o' }, mockFetch([{ status: 401 }]).impl), { ok: false, reason: 'refused' });
  const bad = mockFetch([{ status: 200, json: { checkoutId: 'c', redirectUrl: 'javascript:alert(1)' } }]);
  assert.deepEqual(await createMayaCheckout(config, { amountPhp: 1, reference: 'R', description: 'd', origin: 'o' }, bad.impl), { ok: false, reason: 'bad_answer' });
});

test('verify: GET the payment with the SECRET key; 404 is "no such payment", other faults are "error"', async () => {
  const ok = mockFetch([{ status: 200, json: paid }]);
  assert.deepEqual(await fetchMayaPayment(config, 'pay-1', ok.impl), paid);
  assert.equal(ok.calls[0]!.url, 'https://pg-sandbox.paymaya.com/payments/v1/payments/pay-1');
  assert.equal(ok.calls[0]!.auth, mayaBasicAuth('sk-test'));
  assert.equal(await fetchMayaPayment(config, 'x', mockFetch([{ status: 404 }]).impl), null);
  assert.equal(await fetchMayaPayment(config, 'x', mockFetch([{ status: 503 }]).impl), 'error');
  assert.equal(await fetchMayaPayment({ ...config, secretKey: '' }, 'x', mockFetch([]).impl), 'error', 'no secret key, no verdict');

  const byRef = mockFetch([{ status: 200, json: [paid] }]);
  assert.deepEqual(await fetchMayaPaymentsByReference(config, 'SN12345678', byRef.impl), [paid]);
  assert.equal(byRef.calls[0]!.url, 'https://pg-sandbox.paymaya.com/payments/v1/payment-rrns/SN12345678');
  assert.equal(byRef.calls[0]!.auth, mayaBasicAuth('sk-test'));
});

test('register webhooks: keeps ours, replaces a stale one, adds the missing — all with the SECRET key', async () => {
  const url = 'https://www.setnayan.com/api/webhooks/maya';
  const { impl, calls } = mockFetch([
    { status: 200, json: [
      { id: 'w1', name: 'PAYMENT_SUCCESS', callbackUrl: url },
      { id: 'w2', name: 'PAYMENT_FAILED', callbackUrl: 'https://old.example/hook' },
    ] },
    { status: 200, json: {} }, // DELETE w2
    { status: 200, json: {} }, // POST PAYMENT_FAILED
    { status: 200, json: {} }, // POST PAYMENT_EXPIRED
    { status: 200, json: {} }, // POST PAYMENT_CANCELLED
  ]);
  const res = await registerMayaWebhooks(config, url, impl);
  assert.deepEqual(res, { ok: true, registered: ['PAYMENT_FAILED', 'PAYMENT_EXPIRED', 'PAYMENT_CANCELLED'], kept: ['PAYMENT_SUCCESS'] });
  assert.ok(calls.every((c) => c.auth === mayaBasicAuth('sk-test')));
  assert.deepEqual(calls.map((c) => `${c.method} ${c.url.replace('https://pg-sandbox.paymaya.com', '')}`), [
    'GET /payments/v1/webhooks',
    'DELETE /payments/v1/webhooks/w2',
    'POST /payments/v1/webhooks',
    'POST /payments/v1/webhooks',
    'POST /payments/v1/webhooks',
  ]);
  assert.deepEqual(calls[2]!.body, { name: 'PAYMENT_FAILED', callbackUrl: url });
  assert.deepEqual(await registerMayaWebhooks({ ...config, secretKey: '' }, url, impl), { ok: false, reason: 'no_secret_key' });
});
