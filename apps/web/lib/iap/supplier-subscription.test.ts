/**
 * 🏪 A SHOP'S PLAN, BILLED BY APPLE — every App Store Server Notification the spec names (item D, owner-locked 22 Nov
 * 2026), one test each, through the REAL handler (lib/iap/supplier-subscription.server.ts) and the real reader
 * (lib/iap/apple-subscription.ts). The database half (what each call does to the plan) is proved in
 * tests/db/a-shop-plan-billed-by-apple.db.test.ts; this file proves WHICH call each notification becomes, for WHICH
 * shop, and what is refused before any call: FAMILY_SHARED, a restore on a second shop, another app, another product.
 *
 * Apple's signature is checked by `verifyAppleJws` (proved in apple-jws.test.ts against a test chain whose private keys
 * were never committed). The handler takes the verifier as a parameter, so here it is a decoder — the subject is what
 * happens AFTER Apple signed it.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { VerifyJws } from './supplier-subscription.server';
import { decideSupplierPlanNotification, readAppleSubscriptionTransaction } from './apple-subscription';
import { SUPPLIER_PLAN_PRODUCTS, supplierPlanMove, supplierPlanProductById } from './supplier-plans';
import { stripComments } from '../strip-comments';

const HERE = dirname(fileURLToPath(import.meta.url));

// The server module opens with `import 'server-only'`; node resolves it to nothing here (the same shim as
// lib/welcome-is-the-guests-own.test.ts), then the module is loaded lazily.
{
  const Mod = require('node:module');
  const load = Mod._load;
  Mod._load = function (request: string, ...rest: unknown[]) {
    if (request === 'server-only' || request === 'client-only') return {};
    return load.call(this, request, ...rest);
  };
}
const srv = () => import('./supplier-subscription.server');

const SHOP_A = '11111111-1111-4111-8111-111111111111';
const SHOP_B = '22222222-2222-4222-8222-222222222222';
const PRO = 'com.setnayan.app.supplier_pro_monthly';
const ULTRA = 'com.setnayan.app.supplier_ultra_monthly';
const PLUS = 'com.setnayan.app.supplier_plus_monthly';

const b64 = (o: unknown) => Buffer.from(JSON.stringify(o)).toString('base64url');
const jws = (payload: Record<string, unknown>) => `h.${b64(payload)}.s`;
/** "Apple signed it" — decodes; a token marked `forged` is refused, as a bad signature would be. */
const verify: VerifyJws = (token) => {
  const [, p] = token.split('.');
  const payload = JSON.parse(Buffer.from(p ?? '', 'base64url').toString('utf8')) as Record<string, unknown>;
  return payload.forged ? { ok: false, reason: 'bad_signature' } : { ok: true, payload };
};

function tx(over: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    transactionId: 'tx-1',
    originalTransactionId: 'orig-1',
    bundleId: 'com.setnayan.app',
    productId: PRO,
    type: 'Auto-Renewable Subscription',
    inAppOwnershipType: 'PURCHASED',
    appAccountToken: SHOP_A,
    environment: 'Sandbox',
    purchaseDate: Date.parse('2026-11-22T00:00:00Z'),
    expiresDate: Date.parse('2026-12-22T00:00:00Z'),
    price: 4_990_000,
    currency: 'PHP',
    ...over,
  };
}

function notification(type: string, subtype: string | null, t: Record<string, unknown> = tx(), renewal?: Record<string, unknown>) {
  return {
    notificationType: type,
    ...(subtype ? { subtype } : {}),
    signedDate: Date.parse('2026-12-22T01:00:00Z'),
    data: {
      bundleId: 'com.setnayan.app',
      environment: 'Sandbox',
      signedTransactionInfo: jws(t),
      ...(renewal ? { signedRenewalInfo: jws(renewal) } : {}),
    },
  };
}

type Call = { fn: string; args: Record<string, unknown> };

/** A service-role client double: the map read answers `mapped`, each RPC answers from `answers`. */
function fakeAdmin(opts: { mapped?: string | null; mapError?: boolean; answers?: Record<string, unknown>; rpcError?: string } = {}) {
  const calls: Call[] = [];
  const admin = {
    from(table: string) {
      assert.equal(table, 'vendor_app_store_subscriptions');
      const chain = {
        select: () => chain,
        eq: () => chain,
        maybeSingle: async () =>
          opts.mapError
            ? { data: null, error: { message: 'boom' } }
            : { data: opts.mapped ? { vendor_profile_id: opts.mapped } : null, error: null },
      };
      return chain;
    },
    async rpc(fn: string, args: Record<string, unknown>) {
      calls.push({ fn, args });
      if (opts.rpcError === fn) return { data: null, error: { message: 'boom' } };
      return { data: opts.answers?.[fn] ?? { on: true, noted: true, ended: true }, error: null };
    },
  };
  return { admin: admin as unknown as SupabaseClient, calls };
}

const faults: string[] = [];
const fault = async (m: string) => {
  faults.push(m);
};

async function handle(payload: Record<string, unknown>, admin: SupabaseClient) {
  return (await srv()).handleSupplierPlanNotification(admin, payload, [], fault, verify);
}

// ── The products ─────────────────────────────────────────────────────────────

test('the three products are the owner’s ids, plan names and group levels (Ultra 1 · Pro 2 · Plus 3), monthly only', () => {
  assert.deepEqual(
    SUPPLIER_PLAN_PRODUCTS.map((p) => [p.productId, p.tier, p.name, p.groupLevel]),
    [
      [PLUS, 'solo', 'Plus', 3],
      [PRO, 'pro', 'Pro', 2],
      [ULTRA, 'enterprise', 'Ultra', 1],
    ],
  );
  for (const p of SUPPLIER_PLAN_PRODUCTS) assert.match(p.productId, /_monthly$/);
  const src = stripComments(readFileSync(join(HERE, 'supplier-plans.ts'), 'utf8'));
  assert.doesNotMatch(src, /₱|\b1,?990\b|\b4,?990\b|\b8,?990\b/, 'a price was typed into the product list');
  assert.doesNotMatch(src, /\bMax\b|yearly|annual/i);
});

test('E · up lands now, down at the end of the paid month — by plan, never by price', () => {
  assert.deepEqual(supplierPlanMove('solo', 'pro'), { direction: 'up', lands: 'now' });
  assert.deepEqual(supplierPlanMove('verified', 'solo'), { direction: 'up', lands: 'now' });
  assert.deepEqual(supplierPlanMove('enterprise', 'solo'), { direction: 'down', lands: 'end_of_paid_month' });
  assert.deepEqual(supplierPlanMove('pro', 'pro'), { direction: 'same', lands: 'end_of_paid_month' });
});

// ── The reader ───────────────────────────────────────────────────────────────

test('FAMILY_SHARED is refused before anything reads a shop', () => {
  assert.deepEqual(readAppleSubscriptionTransaction(tx({ inAppOwnershipType: 'FAMILY_SHARED' })), { ok: false, reason: 'family_shared' });
});

test('another app, a consumable, an unknown product and no expiry are refused', () => {
  assert.deepEqual(readAppleSubscriptionTransaction(tx({ bundleId: 'com.other.app' })), { ok: false, reason: 'wrong_app' });
  assert.deepEqual(readAppleSubscriptionTransaction(tx({ productId: 'com.setnayan.app.event_pro' })), { ok: false, reason: 'not_a_supplier_plan' });
  assert.deepEqual(readAppleSubscriptionTransaction(tx({ type: 'Consumable' })), { ok: false, reason: 'not_subscription' });
  assert.deepEqual(readAppleSubscriptionTransaction(tx({ expiresDate: undefined })), { ok: false, reason: 'no_expiry' });
  const ok = readAppleSubscriptionTransaction(tx({ appAccountToken: SHOP_A.toUpperCase() }));
  assert.ok(ok.ok && ok.tx.appAccountToken === SHOP_A && ok.tx.product.tier === 'pro');
});

// ── One test per notification type ───────────────────────────────────────────

test('SUBSCRIBED → the plan, for the shop the appAccountToken names, until Apple’s expiresDate', async () => {
  const { admin, calls } = fakeAdmin({ mapped: null });
  const r = await handle(notification('SUBSCRIBED', 'INITIAL_BUY'), admin);
  assert.deepEqual(r, { http: 200, what: 'supplier plan on' });
  assert.equal(calls.length, 1);
  const a = calls[0]!.args;
  assert.equal(calls[0]!.fn, 'app_store_supplier_plan_apply');
  assert.equal(a.p_vendor_id, SHOP_A);
  assert.equal(a.p_original_tx, 'orig-1');
  assert.equal(a.p_tier, 'pro');
  assert.equal(a.p_sku_code, 'pro_vendor_monthly');
  assert.equal(a.p_expires_at, '2026-12-22T00:00:00.000Z');
  assert.equal(a.p_amount_php, 4990);
});

test('DID_RENEW → the next month, on the MAPPED shop (the token is not asked again)', async () => {
  const { admin, calls } = fakeAdmin({ mapped: SHOP_A });
  const r = await handle(notification('DID_RENEW', 'BILLING_RECOVERY', tx({ transactionId: 'tx-2', appAccountToken: undefined })), admin);
  assert.equal(r?.http, 200);
  assert.equal(calls[0]!.fn, 'app_store_supplier_plan_apply');
  assert.equal(calls[0]!.args.p_vendor_id, SHOP_A);
  assert.equal(calls[0]!.args.p_tx_id, 'tx-2');
});

test('DID_CHANGE_RENEWAL_PREF / UPGRADE → the higher plan NOW (E: up = now)', async () => {
  const { admin, calls } = fakeAdmin({ mapped: SHOP_A });
  await handle(notification('DID_CHANGE_RENEWAL_PREF', 'UPGRADE', tx({ productId: ULTRA, transactionId: 'tx-3' })), admin);
  assert.equal(calls[0]!.fn, 'app_store_supplier_plan_apply');
  assert.equal(calls[0]!.args.p_tier, 'enterprise');
});

test('DID_CHANGE_RENEWAL_PREF / DOWNGRADE → noted for the renewal, nothing changes today (E: down = end of month)', async () => {
  const { admin, calls } = fakeAdmin({ mapped: SHOP_A });
  const r = await handle(notification('DID_CHANGE_RENEWAL_PREF', 'DOWNGRADE', tx(), { autoRenewStatus: 1, autoRenewProductId: PLUS }), admin);
  assert.equal(r?.http, 200);
  assert.deepEqual(calls.map((c) => c.fn), ['app_store_supplier_plan_note']);
  assert.equal(calls[0]!.args.p_auto_renew_product_id, PLUS);
  assert.equal(calls[0]!.args.p_status, null);
});

test('DID_FAIL_TO_RENEW → billing_retry and the date (the grace hook), and no plan change', async () => {
  const { admin, calls } = fakeAdmin({ mapped: SHOP_A });
  const r = await handle(
    notification('DID_FAIL_TO_RENEW', 'GRACE_PERIOD', tx(), { autoRenewStatus: 1, gracePeriodExpiresDate: Date.parse('2026-12-29T00:00:00Z') }),
    admin,
  );
  assert.equal(r?.http, 200);
  assert.deepEqual(calls.map((c) => c.fn), ['app_store_supplier_plan_note']);
  assert.equal(calls[0]!.args.p_status, 'billing_retry');
  assert.equal(calls[0]!.args.p_billing_failed_at, '2026-12-22T01:00:00.000Z');
  assert.equal(calls[0]!.args.p_grace_expires_at, '2026-12-29T00:00:00.000Z');
});

test('GRACE_PERIOD_EXPIRED → the plan ends (the shared sweep drops the shop)', async () => {
  const { admin, calls } = fakeAdmin({ mapped: SHOP_A, answers: { app_store_supplier_plan_end: { ended: 'expired', dropped: true } } });
  const r = await handle(notification('GRACE_PERIOD_EXPIRED', null), admin);
  assert.deepEqual(r, { http: 200, what: 'supplier plan expired, dropped' });
  assert.equal(calls[0]!.fn, 'app_store_supplier_plan_end');
  assert.equal(calls[0]!.args.p_status, 'expired');
});

test('EXPIRED → the plan ends', async () => {
  const { admin, calls } = fakeAdmin({ mapped: SHOP_A });
  await handle(notification('EXPIRED', 'VOLUNTARY'), admin);
  assert.equal(calls[0]!.fn, 'app_store_supplier_plan_end');
  assert.equal(calls[0]!.args.p_status, 'expired');
});

test('REFUND → that transaction’s money went back: the plan drops at once (E)', async () => {
  const { admin, calls } = fakeAdmin({ mapped: SHOP_A });
  await handle(notification('REFUND', null, tx({ transactionId: 'tx-9', revocationDate: Date.now() })), admin);
  assert.equal(calls[0]!.fn, 'app_store_supplier_plan_end');
  assert.equal(calls[0]!.args.p_status, 'refunded');
  assert.equal(calls[0]!.args.p_tx_id, 'tx-9');
});

test('REVOKE → the whole subscription goes: the plan drops at once (E)', async () => {
  const { admin, calls } = fakeAdmin({ mapped: SHOP_A });
  await handle(notification('REVOKE', null), admin);
  assert.equal(calls[0]!.args.p_status, 'revoked');
  assert.equal(calls[0]!.args.p_tx_id, null);
});

test('a consumable’s REFUND is NOT taken by the supplier path (null → notifications.server.ts goes on)', async () => {
  const { admin, calls } = fakeAdmin();
  const r = await handle(
    notification('REFUND', null, { transactionId: 't', bundleId: 'com.setnayan.app', productId: 'com.setnayan.app.event_pro', type: 'Consumable' }),
    admin,
  );
  assert.equal(r, null);
  assert.equal(calls.length, 0);
});

// ── Refusals ─────────────────────────────────────────────────────────────────

test('FAMILY_SHARED → 200 and nothing touched, on every type', async () => {
  for (const type of ['SUBSCRIBED', 'DID_RENEW', 'EXPIRED', 'REFUND', 'REVOKE']) {
    const { admin, calls } = fakeAdmin({ mapped: SHOP_A });
    const r = await handle(notification(type, null, tx({ inAppOwnershipType: 'FAMILY_SHARED' })), admin);
    assert.deepEqual(r, { http: 200, what: 'supplier plan refused: family_shared' }, type);
    assert.equal(calls.length, 0, `${type}: a family member's copy reached the database`);
  }
});

test('A RESTORE ON A SECOND SHOP never grants it: the app’s confirm from shop B on A’s subscription is refused', async () => {
  const { admin, calls } = fakeAdmin({ mapped: SHOP_A });
  const out = await (await srv()).confirmSupplierPlanJws(admin, jws(tx({ appAccountToken: SHOP_B })), async () => [SHOP_B], [], fault, verify);
  assert.deepEqual(out?.result, { status: 'refused', reason: 'other_shop' });
  assert.equal(calls.length, 0, 'the second shop reached the grant');
  // … and on its own shop it lands.
  const own = fakeAdmin({ mapped: SHOP_A });
  const ok = await (await srv()).confirmSupplierPlanJws(own.admin, jws(tx()), async () => [SHOP_A], [], fault, verify);
  assert.equal(ok?.result.status, 'on');
  assert.equal(own.calls[0]!.args.p_vendor_id, SHOP_A);
});

test('a first purchase must name one of the caller’s OWN shops', async () => {
  const { admin, calls } = fakeAdmin({ mapped: null });
  const out = await (await srv()).confirmSupplierPlanJws(admin, jws(tx({ appAccountToken: SHOP_B })), async () => [SHOP_A], [], fault, verify);
  assert.deepEqual(out?.result, { status: 'refused', reason: 'not_yours' });
  assert.equal(calls.length, 0);
});

test('a notification for a mapped subscription follows the subscription, never a different token', async () => {
  const { admin, calls } = fakeAdmin({ mapped: SHOP_A });
  faults.length = 0;
  const o = await (await srv()).applySupplierPlanPeriod(admin, (readAppleSubscriptionTransaction(tx({ appAccountToken: SHOP_B })) as { ok: true; tx: never }).tx, 'DID_RENEW', null, fault);
  assert.equal(o.status, 'on');
  assert.equal(calls[0]!.args.p_vendor_id, SHOP_A);
  assert.equal(faults.length, 1, 'the cross-shop door was not recorded for a person');
});

test('a grant the database refuses (web-billed shop) is 200 and recorded for a person — Apple charged, nothing granted', async () => {
  const { admin } = fakeAdmin({ mapped: null, answers: { app_store_supplier_plan_apply: { refused: 'web_billed', vendor_id: SHOP_A } } });
  faults.length = 0;
  const r = await handle(notification('SUBSCRIBED', 'INITIAL_BUY'), admin);
  assert.deepEqual(r, { http: 200, what: 'supplier plan refused: web_billed' });
  assert.equal(faults.length, 1);
});

test('our failed write is a 500 (Apple retries); a forged inner transaction a 400; an unknown subscription asks again', async () => {
  const broken = fakeAdmin({ mapped: SHOP_A, rpcError: 'app_store_supplier_plan_apply' });
  assert.equal((await handle(notification('DID_RENEW', null), broken.admin))?.http, 500);
  const mapDown = fakeAdmin({ mapError: true });
  assert.equal((await handle(notification('SUBSCRIBED', null), mapDown.admin))?.http, 500);
  const forged = fakeAdmin();
  assert.equal((await handle(notification('SUBSCRIBED', null, tx({ forged: true })), forged.admin))?.http, 400);
  const unknown = fakeAdmin({ answers: { app_store_supplier_plan_note: { unknown: true } } });
  assert.equal((await handle(notification('DID_FAIL_TO_RENEW', null), unknown.admin))?.http, 500);
});

test('every type the spec names has a decision, and none of them is "ignore"', () => {
  for (const type of ['SUBSCRIBED', 'DID_RENEW', 'DID_CHANGE_RENEWAL_PREF', 'DID_FAIL_TO_RENEW', 'GRACE_PERIOD_EXPIRED', 'EXPIRED', 'REFUND', 'REVOKE']) {
    const d = decideSupplierPlanNotification(
      { notificationType: type, subtype: null, signedDate: null },
      { transactionId: 't' },
      { autoRenew: null, autoRenewProductId: null, gracePeriodExpiresDate: null, inBillingRetry: null },
    );
    assert.notEqual(d.kind, 'ignore', type);
  }
  assert.ok(supplierPlanProductById(PRO));
});

test('the notification route hands supplier plans to this path BEFORE the consumable filter', () => {
  const src = stripComments(readFileSync(join(HERE, 'notifications.server.ts'), 'utf8'));
  const plan = src.indexOf('handleSupplierPlanNotification(admin, outer.payload, trustedRoots)');
  const filter = src.indexOf("n.notificationType !== 'ONE_TIME_CHARGE'");
  assert.ok(plan > 0 && filter > plan, 'supplier plans are dispatched after the consumable filter (they would be ignored)');
});
