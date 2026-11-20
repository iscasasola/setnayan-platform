/**
 * 🔁 RENEWING ONE ULTRA ADD-ON EXTENDS THAT ADD-ON — controller ruling on PR #8019, 20 Nov, option A.
 *
 * Review (20 Nov): the renewal email says "renew before then", but the only way to pay again was "Add one", which
 * started a SECOND add-on with its own 28 days — the days left on the first were lost. Now a renewal order keyed
 * `vendor_ultra_addon_renew__<the add-on's order_id>` moves THAT add-on's window to its own live end + 28 days
 * (`ultra_addon_apply_renewal`), touches no other add-on, is never counted as an add-on itself, applies once, and a
 * refund takes back exactly what it added (`ultra_addon_reverse_renewal`).
 *
 * The shop below holds TWO live add-ons, so "the wrong one moved" and "both moved" are both visible.
 *
 * Run: pnpm --filter @setnayan/web test:db
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';

import { ULTRA_ADDON_RENEW_PREFIX, COUNT_ADDONS, ultraAddOnRenewalServiceKey } from '../../lib/vendor-ultra-addons';
import { createReplayedDb, type ReplayResult } from './replay-migrations';

let replay: ReplayResult;
let db: ReplayResult['db'];

before(async () => {
  replay = await createReplayedDb();
  db = replay.db;
});

after(async () => {
  await db?.close();
});

const DAY = 24 * 60 * 60 * 1000;
let seq = 0;

async function newShop(label: string): Promise<{ userId: string; shop: string }> {
  const u = await db.query<{ id: string }>(
    `INSERT INTO auth.users (email, raw_user_meta_data)
     VALUES ($1, jsonb_build_object('account_type','vendor')) RETURNING id`,
    [`${label}-${++seq}@renew-ultra.test`],
  );
  const userId = u.rows[0]!.id;
  const existing = await db.query<{ vendor_profile_id: string }>(
    `SELECT vendor_profile_id FROM public.vendor_profiles WHERE user_id = $1`,
    [userId],
  );
  const shop =
    existing.rows[0]?.vendor_profile_id ??
    (
      await db.query<{ vendor_profile_id: string }>(
        `INSERT INTO public.vendor_profiles (user_id, business_name, location_city)
         VALUES ($1, 'Renew Test', 'Manila') RETURNING vendor_profile_id`,
        [userId],
      )
    ).rows[0]!.vendor_profile_id;
  await db.query(`UPDATE public.vendor_profiles SET tier_state = 'enterprise' WHERE vendor_profile_id = $1`, [shop]);
  return { userId, shop };
}

async function order(
  o: { userId: string; shop: string },
  serviceKey: string,
  status: string,
  expiresInDays: number | null,
): Promise<string> {
  const r = await db.query<{ order_id: string }>(
    `INSERT INTO public.orders
       (event_id, user_id, vendor_profile_id, service_key, description, requested_total_php, status, reference_code, expires_at)
     VALUES (NULL, $1, $2, $3, 'Ultra Add-on', 2490, $4, $5,
             CASE WHEN $6::int IS NULL THEN NULL ELSE now() + make_interval(days => $6::int) END)
     RETURNING order_id`,
    [o.userId, o.shop, serviceKey, status, `RNW${++seq}`, expiresInDays],
  );
  return r.rows[0]!.order_id;
}

const addOnKey = (shop: string) => `${COUNT_ADDONS.ultra.servicePrefix}${shop}`;

async function endsAt(orderId: string): Promise<number | null> {
  const r = await db.query<{ e: string | null }>(`SELECT expires_at::text AS e FROM public.orders WHERE order_id = $1`, [orderId]);
  const e = r.rows[0]?.e ?? null;
  return e === null ? null : Date.parse(e);
}

async function liveCount(shop: string): Promise<number> {
  const r = await db.query<{ n: number }>(`SELECT public.vendor_live_ultra_addons($1) AS n`, [shop]);
  return Number(r.rows[0]!.n);
}

test('the renewal key never starts with the add-on prefix, so the live count can never count a renewal', () => {
  assert.ok(!ULTRA_ADDON_RENEW_PREFIX.startsWith(COUNT_ADDONS.ultra.servicePrefix));
  assert.equal(ultraAddOnRenewalServiceKey('x'), `${ULTRA_ADDON_RENEW_PREFIX}x`);
});

test('two live add-ons: renewing A moves ONLY A, from A’s own end, by 28 days — B and the count stay as they were', async () => {
  const s = await newShop('two');
  const a = await order(s, addOnKey(s.shop), 'paid', 10);
  const b = await order(s, addOnKey(s.shop), 'paid', 20);
  const aBefore = (await endsAt(a))!;
  const bBefore = (await endsAt(b))!;
  assert.equal(await liveCount(s.shop), 2);

  const renewal = await order(s, ultraAddOnRenewalServiceKey(a), 'paid', null);
  await db.query(`SELECT public.ultra_addon_apply_renewal($1)`, [renewal]);

  assert.equal((await endsAt(a))! - aBefore, 28 * DAY, 'A ends 28 days after its OWN end — no paid day lost');
  assert.equal(await endsAt(b), bBefore, 'B is untouched');
  assert.equal(await liveCount(s.shop), 2, 'still two add-ons — the renewal is not a third');

  // Once only: a second approval of the same renewal changes nothing.
  await db.query(`SELECT public.ultra_addon_apply_renewal($1)`, [renewal]);
  assert.equal((await endsAt(a))! - aBefore, 28 * DAY, 'a re-approval does not add another 28 days');

  // A refund takes back exactly the 28 days it added.
  await db.query(`UPDATE public.orders SET status = 'refunded' WHERE order_id = $1`, [renewal]);
  await db.query(`SELECT public.ultra_addon_reverse_renewal($1)`, [renewal]);
  assert.equal(await endsAt(a), aBefore, 'refunded → A ends where it did before');
  assert.equal(await endsAt(b), bBefore, 'B still untouched');
});

test('a renewal is never reminded — the add-on it extended is', async () => {
  const s = await newShop('remind');
  const a = await order(s, addOnKey(s.shop), 'paid', 1);
  const renewal = await order(s, ultraAddOnRenewalServiceKey(a), 'paid', null);
  await db.query(`SELECT public.ultra_addon_apply_renewal($1)`, [renewal]);
  // Pull both back inside the 7-day window to look.
  await db.query(`UPDATE public.orders SET expires_at = now() + interval '2 days' WHERE order_id IN ($1, $2)`, [a, renewal]);
  const due = await db.query<{ order_id: string }>(`SELECT order_id FROM public.subscriptions_due_for_renewal_reminder(7)`);
  const ids = due.rows.map((r) => r.order_id);
  assert.ok(!ids.includes(renewal), 'the renewal order is not reminded');
});

test('a renewal that names another shop’s add-on, or an unpaid one, is refused and moves nothing', async () => {
  const mine = await newShop('mine');
  const theirs = await newShop('theirs');
  const theirAddOn = await order(theirs, addOnKey(theirs.shop), 'paid', 10);
  const before = await endsAt(theirAddOn);

  const stolen = await order(mine, ultraAddOnRenewalServiceKey(theirAddOn), 'paid', null);
  await assert.rejects(db.query(`SELECT public.ultra_addon_apply_renewal($1)`, [stolen]), /names no paid Ultra Add-on/);
  assert.equal(await endsAt(theirAddOn), before);

  const myAddOn = await order(mine, addOnKey(mine.shop), 'paid', 5);
  const unpaid = await order(mine, ultraAddOnRenewalServiceKey(myAddOn), 'submitted', null);
  await assert.rejects(db.query(`SELECT public.ultra_addon_apply_renewal($1)`, [unpaid]), /is not paid/);
});

test('a lapsed add-on renews from today, never from a date in the past', async () => {
  const s = await newShop('lapsed');
  const a = await order(s, addOnKey(s.shop), 'paid', -3);
  const renewal = await order(s, ultraAddOnRenewalServiceKey(a), 'paid', null);
  const t0 = Date.now();
  await db.query(`SELECT public.ultra_addon_apply_renewal($1)`, [renewal]);
  const end = (await endsAt(a))!;
  assert.ok(end >= t0 + 28 * DAY - 60_000, 'at least 28 days from now');
});

test('both functions are the service role’s only', async () => {
  for (const fn of ['ultra_addon_apply_renewal(uuid)', 'ultra_addon_reverse_renewal(uuid)']) {
    for (const role of ['anon', 'authenticated']) {
      const r = await db.query<{ ok: boolean }>(`SELECT has_function_privilege($1, $2, 'EXECUTE') AS ok`, [role, `public.${fn}`]);
      assert.equal(r.rows[0]!.ok, false, `${role} must not execute ${fn}`);
    }
  }
});
