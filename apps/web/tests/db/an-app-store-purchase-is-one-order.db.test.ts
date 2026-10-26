/**
 * 🍎 AN APP STORE PURCHASE IS ONE ORDER — verify → order → activation, refund →
 * deactivation, and the same transaction twice is still one order. Run against
 * the REPLAYED schema with the REAL production modules (lib/iap/fulfil.server.ts,
 * lib/iap/notifications.server.ts, lib/sku-activation.ts) over the PGlite
 * adapter that stands in for the service-role client.
 *
 * Apple is MOCKED by signature, not by skipping the check: every transaction
 * here is a JWS signed by a throwaway test chain (lib/iap/apple-jws.fixture.json)
 * and goes through the same `verifyAppleJws` production uses — only the trusted
 * root differs. Nothing calls Apple.
 *
 * 🛡 Sabotaged, each red then restored (2026-10-18) — see the PR body for the list.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import type { PGlite } from '@electric-sql/pglite';
import type { SupabaseClient } from '@supabase/supabase-js';

import { createReplayedDb, type ReplayResult } from './replay-migrations';
import { makeAdminClient } from './supabase-over-pglite';
import { FIXTURE_ROOTS, FIXTURE_TOKENS, fixtureJws } from '../../lib/iap/apple-jws-fixture';
import { verifyAppleTransaction } from '../../lib/iap/apple-transaction';
import { iapProductById } from '../../lib/iap/products';

let replay: ReplayResult;
let db: PGlite;
let admin: SupabaseClient;
let fulfil: typeof import('../../lib/iap/fulfil.server');
let notify: typeof import('../../lib/iap/notifications.server');
let seq = 0;

before(async () => {
  replay = await createReplayedDb();
  db = replay.db;
  admin = makeAdminClient(db);
  fulfil = await import('../../lib/iap/fulfil.server');
  notify = await import('../../lib/iap/notifications.server');
});
after(async () => {
  await db?.close();
});

async function newCouple(): Promise<{ userId: string; eventId: string }> {
  const n = seq++;
  const u = await db.query<{ id: string }>(
    `INSERT INTO auth.users (email, raw_user_meta_data)
     VALUES ($1, jsonb_build_object('account_type','customer')) RETURNING id`,
    [`iap-${n}@example.test`],
  );
  const userId = u.rows[0]!.id;
  const e = await db.query<{ event_id: string }>(
    `INSERT INTO public.events (display_name, event_type, slug) VALUES ('Maria & Jose', 'birthday', $1) RETURNING event_id`,
    [`iap-${n}`],
  );
  const eventId = e.rows[0]!.event_id;
  await db.query(`INSERT INTO public.event_members (event_id, user_id, member_type) VALUES ($1, $2, 'couple')`, [
    eventId,
    userId,
  ]);
  return { userId, eventId };
}

/** The intent row `startAppStorePurchase` writes — here with the fixture's fixed token. */
async function intent(token: string, userId: string, eventId: string, productId: string): Promise<void> {
  const p = iapProductById(productId)!;
  await db.query(
    `INSERT INTO public.app_store_purchases (app_account_token, user_id, event_id, product_id, service_key)
     VALUES ($1, $2, $3, $4, $5)`,
    [token, userId, eventId, p.productId, p.serviceKey],
  );
}

function tx(key: string) {
  const v = verifyAppleTransaction(fixtureJws(key), FIXTURE_ROOTS);
  assert.ok(v.ok, `fixture ${key} must verify against the test root`);
  return v.tx;
}

const ordersFor = async (eventId: string) =>
  (
    await db.query<{ order_id: string; status: string; platform: string; service_key: string; reference_code: string; requested_total_php: string; payment_method_key: string }>(
      `SELECT order_id, status::text AS status, platform, service_key, reference_code, requested_total_php::text, payment_method_key
         FROM public.orders WHERE event_id = $1`,
      [eventId],
    )
  ).rows;
const paymentsFor = async (orderId: string) =>
  (
    await db.query<{ status: string; channel: string; reference_number: string; amount_php: string }>(
      `SELECT status::text AS status, channel, reference_number, amount_php::text FROM public.payments WHERE order_id = $1`,
      [orderId],
    )
  ).rows;
const grantsFor = async (orderId: string) =>
  (
    await db.query<{ points: number; source: string }>(
      `SELECT points, source FROM public.papic_event_point_grants WHERE order_id = $1`,
      [orderId],
    )
  ).rows;

test('verify → order → activation: a Papic pack becomes ONE paid iOS order, a matched App Store payment, and its credits', async () => {
  const { userId, eventId } = await newCouple();
  await intent(FIXTURE_TOKENS.papic, userId, eventId, 'com.setnayan.app.papic_credits_500');

  const out = await fulfil.fulfilAppleTransaction(admin, tx('txPapic'), { expectUserId: userId });
  assert.equal(out.status, 'on', JSON.stringify(out));

  const orders = await ordersFor(eventId);
  assert.equal(orders.length, 1);
  const o = orders[0]!;
  assert.equal(o.status, 'paid');
  assert.equal(o.platform, 'ios');
  assert.equal(o.service_key, 'PAPIC_GUEST_500');
  assert.equal(o.payment_method_key, 'app_store');
  assert.equal(o.reference_code, 'IOS-2000000000000002');
  // What Apple charged (fixture: 419000 milli-PHP), not the web's catalogue figure.
  assert.equal(Number(o.requested_total_php), 419);

  const pays = await paymentsFor(o.order_id);
  assert.deepEqual(pays.map((p) => [p.status, p.channel, p.reference_number, Number(p.amount_php)]), [
    ['matched', 'app_store', '2000000000000002', 419],
  ]);

  // The SAME activation hook the admin approval runs: one top-up grant of the tier's points.
  const grants = await grantsFor(o.order_id);
  assert.deepEqual(grants, [{ points: 500, source: 'topup_order' }]);

  const link = await db.query<{ order_id: string; transaction_id: string; environment: string }>(
    `SELECT order_id, transaction_id, environment FROM public.app_store_purchases WHERE app_account_token = $1`,
    [FIXTURE_TOKENS.papic],
  );
  assert.deepEqual(link.rows[0], { order_id: o.order_id, transaction_id: '2000000000000002', environment: 'Sandbox' });
});

test('replay idempotency: the same transaction twice (and via the notification) is still ONE order, ONE payment, ONE grant', async () => {
  const before = await db.query<{ n: number }>(`SELECT count(*)::int AS n FROM public.orders WHERE reference_code = 'IOS-2000000000000002'`);
  assert.equal(before.rows[0]!.n, 1);
  const again = await fulfil.fulfilAppleTransaction(admin, tx('txPapic'));
  assert.equal(again.status, 'on');
  assert.equal(again.status === 'on' && again.activatedNow, false, 'a repeat must never re-run activation');
  const orderId = again.status === 'on' ? again.orderId : '';
  assert.equal((await db.query<{ n: number }>(`SELECT count(*)::int AS n FROM public.orders WHERE reference_code = 'IOS-2000000000000002'`)).rows[0]!.n, 1);
  assert.equal((await paymentsFor(orderId)).length, 1);
  assert.equal((await grantsFor(orderId)).length, 1, 'credits granted once, not twice');
});

test('App Store Server Notifications: ONE_TIME_CHARGE lands Live Watch with no session; the app’s own confirm then finds the same order', async () => {
  const { userId, eventId } = await newCouple();
  await intent(FIXTURE_TOKENS.live, userId, eventId, 'com.setnayan.app.live_watch');
  const r = await notify.handleAppStoreNotification(admin, fixtureJws('notifOneTimeLive'), FIXTURE_ROOTS);
  assert.deepEqual(r, { http: 200, what: 'fulfil on' });
  const orders = await ordersFor(eventId);
  assert.equal(orders.length, 1);
  assert.equal(orders[0]!.status, 'paid');
  assert.equal(orders[0]!.service_key, 'LIVE_STUDIO');

  const viaApp = await fulfil.fulfilAppleTransaction(admin, tx('txLive'), { expectUserId: userId });
  assert.equal(viaApp.status, 'on');
  assert.equal((await ordersFor(eventId)).length, 1);
});

test('refund → deactivation: a REFUND notification takes Event Hub Pro off; a second REFUND changes nothing', async () => {
  const { userId, eventId } = await newCouple();
  await intent(FIXTURE_TOKENS.pro, userId, eventId, 'com.setnayan.app.event_hub_pro');
  const on = await fulfil.fulfilAppleTransaction(admin, tx('txPro'), { expectUserId: userId });
  assert.equal(on.status, 'on');
  assert.equal((await ordersFor(eventId))[0]!.status, 'paid');

  const r = await notify.handleAppStoreNotification(admin, fixtureJws('notifRefundPro'), FIXTURE_ROOTS);
  assert.deepEqual(r, { http: 200, what: 'revoke revoked' });
  assert.equal((await ordersFor(eventId))[0]!.status, 'refunded');
  const row = await db.query<{ revoked: boolean; t: string }>(
    `SELECT revoked_at IS NOT NULL AS revoked, last_notification_type AS t FROM public.app_store_purchases WHERE app_account_token = $1`,
    [FIXTURE_TOKENS.pro],
  );
  assert.deepEqual(row.rows[0], { revoked: true, t: 'REFUND' });

  const again = await notify.handleAppStoreNotification(admin, fixtureJws('notifRefundPro'), FIXTURE_ROOTS);
  assert.deepEqual(again, { http: 200, what: 'revoke already' });

  // A refunded purchase never comes back on by re-delivery of the original transaction.
  const replayed = await fulfil.fulfilAppleTransaction(admin, tx('txPro'), { expectUserId: userId });
  assert.equal(replayed.status, 'refunded');
  assert.equal((await ordersFor(eventId))[0]!.status, 'refunded');
});

test('refund of a Papic pack takes its credits back (deactivateOrderSku)', async () => {
  const t = tx('txPapic');
  const { rows } = await db.query<{ order_id: string }>(`SELECT order_id FROM public.orders WHERE reference_code = 'IOS-2000000000000002'`);
  const orderId = rows[0]!.order_id;
  assert.equal((await grantsFor(orderId)).length, 1);
  const r = await fulfil.revokeAppleTransaction(admin, { ...t, revocationDate: new Date(), revocationReason: 1 }, 'REFUND');
  assert.deepEqual(r, { status: 'revoked' });
  assert.equal((await grantsFor(orderId)).length, 0, 'refund the money, keep the credits — never');
});

test('a purchase is only ever attached to its OWN intent: wrong account, unknown token, forged payload → no order', async () => {
  const { userId, eventId } = await newCouple();
  const stranger = await newCouple();
  // Same Pro fixture token is already used above; use a fresh product token via a forged-shape check instead.
  const notYours = await fulfil.fulfilAppleTransaction(admin, tx('txLive'), { expectUserId: stranger.userId });
  assert.deepEqual(notYours, { status: 'refused', reason: 'not_yours' });

  // No intent row for this token at all.
  const unknown = await fulfil.fulfilAppleTransaction(admin, { ...tx('txLive'), appAccountToken: '99999999-9999-4999-8999-999999999999', transactionId: '2000000000000077' });
  assert.deepEqual(unknown, { status: 'refused', reason: 'unknown_token' });

  // A notification nobody signed is refused before a single field is read.
  const [h, p, s] = fixtureJws('notifOneTimeLive').split('.') as [string, string, string];
  const body = JSON.parse(Buffer.from(p, 'base64url').toString('utf8'));
  body.notificationType = 'ONE_TIME_CHARGE';
  body.data.bundleId = 'com.setnayan.app';
  const forged = [h, Buffer.from(JSON.stringify({ ...body, notificationUUID: 'x' })).toString('base64url'), s].join('.');
  assert.deepEqual(await notify.handleAppStoreNotification(admin, forged, FIXTURE_ROOTS), { http: 400, what: 'refused: bad_signature' });

  // And production trusts only Apple: the test-signed TEST notification is a 400 there.
  assert.equal((await notify.handleAppStoreNotification(admin, fixtureJws('notifTest'))).http, 400);
  assert.deepEqual(await notify.handleAppStoreNotification(admin, fixtureJws('notifTest'), FIXTURE_ROOTS), { http: 200, what: 'TEST' });

  assert.equal((await ordersFor(eventId)).length, 0);
  assert.equal((await ordersFor(stranger.eventId)).length, 0);
  void userId;
});

test('a transaction for another app is refused at the door', () => {
  const v = verifyAppleTransaction(fixtureJws('txOtherBundle'), FIXTURE_ROOTS);
  assert.deepEqual(v, { ok: false, reason: 'wrong_app' });
});

test('the intent row is service-role only — RLS on, nothing granted to anon or authenticated', async () => {
  const rls = await db.query<{ on: boolean }>(
    `SELECT relrowsecurity AS on FROM pg_class WHERE oid = 'public.app_store_purchases'::regclass`,
  );
  assert.equal(rls.rows[0]!.on, true);
  const grants = await db.query<{ grantee: string }>(
    `SELECT DISTINCT grantee FROM information_schema.role_table_grants
      WHERE table_schema = 'public' AND table_name = 'app_store_purchases' AND grantee IN ('anon','authenticated','PUBLIC')`,
  );
  assert.deepEqual(grants.rows, []);
  const policies = await db.query<{ n: number }>(
    `SELECT count(*)::int AS n FROM pg_policies WHERE schemaname = 'public' AND tablename = 'app_store_purchases'`,
  );
  assert.equal(policies.rows[0]!.n, 0);
});

/* ═══ 🍎 23 Oct — the five more (owner: "Add Setnayan AI, Music Maker, Patiktok, Thank You and Mood Board pack as
   Apple products before submitting build 6.") Each lands as ONE order through the web's own activation hook, and a
   refund takes back what that hook gave. The signed fixtures predate these products, so each purchase is a VERIFIED
   fixture transaction re-pointed at the new product and a fresh token (the fulfilment never re-verifies; what is
   under test here is the order and the activation, the signature path is held above). ═══ */

let fresh = 0;
async function buyInApp(productId: string) {
  const { userId, eventId } = await newCouple();
  const n = String(++fresh).padStart(4, '0');
  const token = `7e57${n}-0000-4000-8000-00000000${n}`;
  await intent(token, userId, eventId, productId);
  const t = { ...tx('txLive'), appAccountToken: token, transactionId: `30000000000${n}`, originalTransactionId: `30000000000${n}`, product: iapProductById(productId)! };
  const out = await fulfil.fulfilAppleTransaction(admin, t, { expectUserId: userId });
  assert.equal(out.status, 'on', JSON.stringify(out));
  return { userId, eventId, t, orderId: out.status === 'on' ? out.orderId : '' };
}
test('✦ Setnayan AI: the purchase switches the event’s flag on; Apple’s refund switches it off again', async () => {
  const { eventId, t } = await buyInApp('com.setnayan.app.setnayan_ai');
  const flag = async () => (await db.query<{ on: boolean }>(`SELECT setnayan_ai_active AS on FROM public.events WHERE event_id = $1`, [eventId])).rows[0]!.on;
  assert.equal(await flag(), true, 'the web’s SETNAYAN_AI hook did not run');
  assert.deepEqual(await fulfil.revokeAppleTransaction(admin, { ...t, revocationDate: new Date(), revocationReason: 1 }, 'REFUND'), { status: 'revoked' });
  assert.equal(await flag(), false, 'refunded and still on');
});

test('Music Maker · Patiktok · Thank You: each ONE paid iOS order (ownership reads it); a refund leaves it refunded', async () => {
  for (const [productId, key] of [
    ['com.setnayan.app.music_maker', 'PAKANTA'],
    ['com.setnayan.app.patiktok', 'PATIKTOK_COMPILER'],
    ['com.setnayan.app.papic_thank_you', 'PAPIC_ADDON_THANK_YOU'],
  ] as const) {
    const { eventId, t } = await buyInApp(productId);
    assert.deepEqual((await ordersFor(eventId)).map((o) => [o.status, o.service_key, o.platform]), [['paid', key, 'ios']], productId);
    assert.deepEqual(await fulfil.revokeAppleTransaction(admin, { ...t, revocationDate: new Date(), revocationReason: 1 }, 'REFUND'), { status: 'revoked' });
    assert.equal((await ordersFor(eventId))[0]!.status, 'refunded', productId);
  }
});

test('✦ a Setnayan AI TIER product (owner 2026-10-23: one per web tier) lands as the ONE SETNAYAN_AI order and switches the flag on', async () => {
  const { eventId } = await buyInApp('com.setnayan.app.setnayan_ai_tier_d');
  assert.deepEqual((await ordersFor(eventId)).map((o) => [o.status, o.service_key, o.platform]), [['paid', 'SETNAYAN_AI', 'ios']]);
  const on = await db.query<{ on: boolean }>(`SELECT setnayan_ai_active AS on FROM public.events WHERE event_id = $1`, [eventId]);
  assert.equal(on.rows[0]!.on, true, 'a tier product did not run the web’s SETNAYAN_AI hook');
});
