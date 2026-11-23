import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createReplayedDb, type ReplayResult } from './replay-migrations';

/**
 * 🍎 A SHOP'S PLAN, BILLED BY APPLE — migration 20271359936839, proved at the database.
 *
 * Spec items D + E (corpus SUPPLIER_SUBSCRIPTIONS_BUILD_SPEC_2026-11-22.md, owner-locked 22 Nov):
 *   · Apple grants through the SAME applier the web uses (`_apply_subscription_credit`) and ends through the SAME
 *     sweep (`sweep_vendor_tier_expiry`) — no second source of truth;
 *   · one subscription = one shop: a restore / renewal on a second shop never moves it;
 *   · one channel at a time, both ways;
 *   · DID_FAIL_TO_RENEW records the first failed date (the grace hook) and nothing else;
 *   · E: a reversed plan (Apple REFUND / REVOKE, a Maya refund or chargeback) drops at once.
 */

let replay: ReplayResult;
let db: ReplayResult['db'];
let n = 0;

before(async () => {
  replay = await createReplayedDb();
  db = replay.db;
});

after(async () => {
  await db?.close();
});

async function shop(tier = 'verified', expiresSql = 'NULL'): Promise<string> {
  n += 1;
  const u = await db.query<{ id: string }>(
    `INSERT INTO auth.users (email, raw_user_meta_data)
     VALUES ($1, jsonb_build_object('account_type','customer')) RETURNING id`,
    [`apple-plan-${n}@test.local`],
  );
  const v = await db.query<{ vendor_profile_id: string }>(
    `INSERT INTO public.vendor_profiles
       (user_id, business_name, location_city, services, verification_state, last_verified_at, tier_state, tier_expires_at)
     VALUES ($1, 'Apple Plan Shop', 'Manila', ARRAY['photography']::text[], 'verified', NOW(),
             $2::public.vendor_tier_state, ${expiresSql})
     RETURNING vendor_profile_id`,
    [u.rows[0]!.id, tier],
  );
  return v.rows[0]!.vendor_profile_id;
}

type Out = Record<string, unknown>;
async function apply(
  vendor: string,
  orig: string,
  tx: string,
  tier: 'solo' | 'pro' | 'enterprise',
  expiresSql = "NOW() + INTERVAL '30 days'",
): Promise<Out> {
  const product = { solo: 'plus', pro: 'pro', enterprise: 'ultra' }[tier];
  const r = await db.query<{ o: Out }>(
    `SELECT public.app_store_supplier_plan_apply(
       $1::uuid, $2, $3, $4, $5::public.vendor_tier_state, $6, NOW(), ${expiresSql}, 1990, 'Sandbox', 'SUBSCRIBED') AS o`,
    [vendor, orig, tx, `com.setnayan.app.supplier_${product}_monthly`, tier, `${tier}_vendor_monthly`],
  );
  return r.rows[0]!.o;
}

async function plan(vendor: string) {
  const r = await db.query<{ tier_state: string; tier_expires_at: string | null; channel: string | null }>(
    `SELECT tier_state, tier_expires_at, public.vendor_plan_billing_channel(vendor_profile_id) AS channel
       FROM public.vendor_profiles WHERE vendor_profile_id = $1`,
    [vendor],
  );
  return r.rows[0]!;
}

async function mapRow(orig: string) {
  const r = await db.query<{ status: string; billing_failed_at: string | null; vendor_profile_id: string }>(
    `SELECT status, billing_failed_at, vendor_profile_id FROM public.vendor_app_store_subscriptions WHERE original_transaction_id = $1`,
    [orig],
  );
  return r.rows[0];
}

test('SUBSCRIBED: the shared applier switches the plan on, and Apple’s expiresDate is the clock', async () => {
  const v = await shop();
  const out = await apply(v, 'orig-1', 'tx-1', 'pro', "TIMESTAMPTZ '2099-01-01 00:00:00+00'");
  assert.equal(out.on, true);
  const p = await plan(v);
  assert.equal(p.tier_state, 'pro');
  assert.equal(new Date(p.tier_expires_at!).toISOString(), '2099-01-01T00:00:00.000Z');
  assert.equal(p.channel, 'app_store');
  const row = await db.query<{ status: string; reference_code: string; plan_change_kind: string }>(
    `SELECT status, reference_code, plan_change_kind FROM public.vendor_subscriptions WHERE vendor_id = $1`,
    [v],
  );
  assert.deepEqual(row.rows, [{ status: 'paid', reference_code: 'APL-tx-1', plan_change_kind: 'app_store' }]);
  // The same transaction again (the app's confirm AND Apple's notification) lands once.
  const again = await apply(v, 'orig-1', 'tx-1', 'pro');
  assert.equal(again.already, true);
  const count = await db.query<{ c: number }>(`SELECT count(*)::int AS c FROM public.vendor_subscriptions WHERE vendor_id = $1`, [v]);
  assert.equal(count.rows[0]!.c, 1);
});

test('ONE SUBSCRIPTION = ONE SHOP: a restore on a second shop never grants it', async () => {
  const a = await shop();
  const b = await shop();
  assert.equal((await apply(a, 'orig-2', 'tx-2a', 'solo')).on, true);
  const out = await apply(b, 'orig-2', 'tx-2b', 'solo');
  assert.equal(out.refused, 'other_shop');
  assert.equal((await plan(b)).tier_state, 'verified', 'the second shop got the plan');
  assert.equal((await mapRow('orig-2'))!.vendor_profile_id, a);
});

test('ONE CHANNEL: an Apple-billed shop cannot start a web purchase, and a web-billed shop is not granted by Apple', async () => {
  const apple = await shop();
  await apply(apple, 'orig-3', 'tx-3', 'pro');
  await assert.rejects(
    () =>
      db.query(
        `INSERT INTO public.vendor_subscriptions (vendor_id, sku_code, tier, billing_cycle, amount_php, period_days)
         VALUES ($1, 'enterprise_vendor_monthly', 'enterprise', 'monthly', 8990, 30)`,
        [apple],
      ),
    /APP_STORE_BILLED/,
  );

  const web = await shop('pro', "NOW() + INTERVAL '20 days'");
  await db.query(
    `INSERT INTO public.vendor_subscriptions (vendor_id, sku_code, tier, billing_cycle, amount_php, period_days, status, paid_at, activated_at, expires_at)
     VALUES ($1, 'pro_vendor_monthly', 'pro', 'monthly', 4990, 30, 'paid', NOW(), NOW(), NOW() + INTERVAL '20 days')`,
    [web],
  );
  assert.equal((await plan(web)).channel, 'web');
  const out = await apply(web, 'orig-4', 'tx-4', 'enterprise');
  assert.equal(out.refused, 'web_billed');
  assert.equal((await plan(web)).tier_state, 'pro');
  assert.equal(await mapRow('orig-4'), undefined, 'a refused subscription was mapped to the shop');
});

test('DID_FAIL_TO_RENEW records the FIRST failed date (the grace hook) and leaves the plan; a renewal clears it', async () => {
  const v = await shop();
  await apply(v, 'orig-5', 'tx-5', 'pro');
  const note = (when: string) =>
    db.query(
      `SELECT public.app_store_supplier_plan_note($1, 'billing_retry', $2::timestamptz, NULL, NULL, NULL, 'DID_FAIL_TO_RENEW')`,
      ['orig-5', when],
    );
  await note('2026-11-20T00:00:00Z');
  await note('2026-11-21T00:00:00Z');
  const m = (await mapRow('orig-5'))!;
  assert.equal(m.status, 'billing_retry');
  assert.equal(new Date(m.billing_failed_at!).toISOString(), '2026-11-20T00:00:00.000Z', 'a later failure moved the first date');
  assert.equal((await plan(v)).tier_state, 'pro', 'a failed renewal took the plan');
  await apply(v, 'orig-5', 'tx-5b', 'pro', "NOW() + INTERVAL '60 days'");
  const after = (await mapRow('orig-5'))!;
  assert.equal(after.status, 'active');
  assert.equal(after.billing_failed_at, null);
});

test('a lower plan arriving at Apple’s renewal lands on a live higher tier (Apple deferred it, not us)', async () => {
  const v = await shop();
  await apply(v, 'orig-6', 'tx-6', 'enterprise', "NOW() + INTERVAL '1 hour'");
  const out = await apply(v, 'orig-6', 'tx-6b', 'solo', "NOW() + INTERVAL '31 days'");
  assert.equal(out.on, true);
  assert.equal((await plan(v)).tier_state, 'solo');
});

test('EXPIRED drops the shop through the shared sweep, like any lapsed plan', async () => {
  const v = await shop();
  await apply(v, 'orig-7', 'tx-7', 'pro');
  const r = await db.query<{ o: Out }>(`SELECT public.app_store_supplier_plan_end('orig-7', 'expired', NULL, 'EXPIRED') AS o`);
  assert.equal(r.rows[0]!.o.dropped, true);
  const p = await plan(v);
  assert.equal(p.tier_state, 'verified');
  assert.equal(p.tier_expires_at, null);
  assert.equal(p.channel, null);
  assert.equal((await mapRow('orig-7'))!.status, 'expired');
});

test('E · an Apple REFUND drops the plan AT ONCE and the period reads refunded', async () => {
  const v = await shop();
  await apply(v, 'orig-8', 'tx-8', 'enterprise');
  const r = await db.query<{ o: Out }>(`SELECT public.app_store_supplier_plan_end('orig-8', 'refunded', 'tx-8', 'REFUND') AS o`);
  assert.equal(r.rows[0]!.o.dropped, true);
  assert.equal((await plan(v)).tier_state, 'verified');
  const row = await db.query<{ status: string }>(`SELECT status FROM public.vendor_subscriptions WHERE reference_code = 'APL-tx-8'`);
  assert.equal(row.rows[0]!.status, 'refunded');
  assert.equal((await mapRow('orig-8'))!.status, 'refunded');
});

test('E · a REVOKE drops the plan at once', async () => {
  const v = await shop();
  await apply(v, 'orig-9', 'tx-9', 'pro');
  await db.query(`SELECT public.app_store_supplier_plan_end('orig-9', 'revoked', NULL, 'REVOKE')`);
  assert.equal((await plan(v)).tier_state, 'verified');
  assert.equal((await mapRow('orig-9'))!.status, 'revoked');
});

test('E · a Maya refund or chargeback of the live web plan drops it at once; a pending order is untouched', async () => {
  const v = await shop('pro', "NOW() + INTERVAL '20 days'");
  const paid = await db.query<{ purchase_id: string }>(
    `INSERT INTO public.vendor_subscriptions (vendor_id, sku_code, tier, billing_cycle, amount_php, period_days, status, paid_at, activated_at, expires_at)
     VALUES ($1, 'pro_vendor_monthly', 'pro', 'monthly', 4990, 30, 'paid', NOW(), NOW(), NOW() + INTERVAL '20 days')
     RETURNING purchase_id`,
    [v],
  );
  const pending = await db.query<{ purchase_id: string }>(
    `INSERT INTO public.vendor_subscriptions (vendor_id, sku_code, tier, billing_cycle, amount_php, period_days)
     VALUES ($1, 'enterprise_vendor_monthly', 'enterprise', 'monthly', 8990, 30) RETURNING purchase_id`,
    [v],
  );
  const skip = await db.query<{ o: Out }>(`SELECT public.vendor_plan_money_reversed($1, 'chargeback') AS o`, [pending.rows[0]!.purchase_id]);
  assert.equal(skip.rows[0]!.o.skipped, 'pending_payment');
  assert.equal((await plan(v)).tier_state, 'pro');

  const out = await db.query<{ o: Out }>(`SELECT public.vendor_plan_money_reversed($1, 'chargeback') AS o`, [paid.rows[0]!.purchase_id]);
  assert.equal(out.rows[0]!.o.dropped, true);
  assert.equal((await plan(v)).tier_state, 'verified');
  const again = await db.query<{ o: Out }>(`SELECT public.vendor_plan_money_reversed($1, 'chargeback') AS o`, [paid.rows[0]!.purchase_id]);
  assert.equal(again.rows[0]!.o.already, true);
});

test('none of the functions is callable by a signed-in user', async () => {
  const r = await db.query<{ fn: string; can: boolean }>(
    `SELECT p.proname AS fn, has_function_privilege('authenticated', p.oid, 'EXECUTE') AS can
       FROM pg_proc p JOIN pg_namespace ns ON ns.oid = p.pronamespace
      WHERE ns.nspname = 'public'
        AND p.proname IN ('vendor_plan_billing_channel', 'vendor_plan_money_reversed', 'app_store_supplier_plan_apply',
                          'app_store_supplier_plan_note', 'app_store_supplier_plan_end')`,
  );
  assert.equal(r.rows.length, 5);
  for (const row of r.rows) assert.equal(row.can, false, `${row.fn} is callable by authenticated`);
});
