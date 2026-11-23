import { test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { createReplayedDb, setAuthUid, type ReplayResult } from './replay-migrations';

/**
 * 🗓 A SUPPLIER PLAN BILLS BY THE CALENDAR MONTH, NOT EVERY 28 DAYS (migration 20271360344805).
 *
 * Owner, 23 Nov 2026: *"the plan is not per 4 weeks. it is now monthly"*. DECISION_LOG 2026-11-22 "SUPPLIER AND
 * COORDINATOR PLANS AND THE ULTRA PACK BILL MONTHLY EVERYWHERE … REPLACES 'EVERY 4 WEEKS'" (3): renewals move from
 * +28 days to +1 month, and a shop already paying keeps its current period until it ends, then renews monthly.
 *
 *   1 · A new monthly order, chosen by the shop and approved, runs one calendar month on the Manila calendar.
 *   2 · A renewal that starts on a month's last day lands on the next month's last day (Jan 31 → Feb 28, or Feb 29
 *       in a leap year), and the purchase records the days that month holds.
 *   3 · A 28-day term already running keeps its end; its renewal adds a month from that end; its unused credit is
 *       still read over 28 days.
 *   4 · The unused credit of a month-long term is read over the month it actually holds.
 *   5 · A paid scheduled plan lands for a calendar month.
 *   6 · The "cover the time you already have" rule is month-shaped: equal is allowed, an hour over is refused.
 *   7 · The plan names say "monthly".
 */

let replay: ReplayResult;
let db: ReplayResult['db'];
let seq = 0;

before(async () => {
  replay = await createReplayedDb();
  db = replay.db;
});
after(async () => {
  await db.exec('RESET ROLE').catch(() => {});
  await setAuthUid(db, null);
  await db?.close();
});
beforeEach(async () => {
  await db.exec('RESET ROLE').catch(() => {});
  await setAuthUid(db, null);
  await db.query(`SELECT set_config('request.jwt.claim.role', '', false)`);
});

async function signIn(uid: string | null): Promise<void> {
  await setAuthUid(db, uid);
  await db.query(`SELECT set_config('request.jwt.claim.role', $1, false)`, [uid ? 'authenticated' : '']);
}

/** A verified shop on `tier` with its owner on the team, its term ending at `expiresSql`. */
async function newShop(tier: string, expiresSql: string): Promise<{ vendorId: string; uid: string }> {
  seq += 1;
  const u = await db.query<{ id: string }>(
    // 'customer', so the signup trigger does not mint a second vendor_profiles row (UNIQUE on user_id).
    `INSERT INTO auth.users (email, raw_user_meta_data)
     VALUES ($1, jsonb_build_object('account_type','customer')) RETURNING id`,
    [`calendar-month-${seq}@test.local`],
  );
  const uid = u.rows[0]!.id;
  const v = await db.query<{ vendor_profile_id: string }>(
    `INSERT INTO public.vendor_profiles
       (user_id, business_name, location_city, services, verification_state, last_verified_at,
        tier_state, tier_expires_at, tier_billing_cycle)
     VALUES ($1, 'Calendar Month Test', 'Manila', ARRAY['photography']::text[], 'verified', NOW(),
             $2::public.vendor_tier_state, ${expiresSql},
             CASE WHEN $2 IN ('solo','pro','enterprise') THEN 'monthly' END)
     RETURNING vendor_profile_id`,
    [uid, tier],
  );
  const vendorId = v.rows[0]!.vendor_profile_id;
  await db.query(
    `INSERT INTO public.vendor_team_members (vendor_profile_id, user_id, role)
     VALUES ($1, $2, 'owner') ON CONFLICT DO NOTHING`,
    [vendorId, uid],
  );
  return { vendorId, uid };
}

async function newConsoleAdmin(): Promise<string> {
  seq += 1;
  const u = await db.query<{ id: string }>(
    `INSERT INTO auth.users (email, raw_user_meta_data)
     VALUES ($1, jsonb_build_object('account_type','admin')) RETURNING id`,
    [`calendar-month-admin-${seq}@test.local`],
  );
  await db.query(`UPDATE public.users SET account_type = 'admin' WHERE user_id = $1`, [u.rows[0]!.id]);
  return u.rows[0]!.id;
}

/** A paid plan purchase written directly: the history a running term stands on. */
async function paidPurchase(vendorId: string, tier: string, amount: number, periodDays: number, expiresSql: string) {
  seq += 1;
  const r = await db.query<{ purchase_id: string }>(
    `INSERT INTO public.vendor_subscriptions
       (vendor_id, sku_code, tier, billing_cycle, amount_php, reference_code,
        period_days, status, activated_at, paid_at, expires_at)
     VALUES ($1, $2, $3::public.vendor_tier_state, 'monthly', $4, $5, $6, 'paid', NOW(), NOW(), ${expiresSql})
     RETURNING purchase_id`,
    [vendorId, `${tier}_vendor_monthly`, tier, amount, `SUB-M${seq.toString().padStart(7, '0')}`, periodDays],
  );
  return r.rows[0]!.purchase_id;
}

/** A pending monthly purchase of `kind`, as an order written before or after this migration would be. */
async function pendingPurchase(vendorId: string, tier: string, kind: string, amount: number, periodDays = 28) {
  seq += 1;
  const r = await db.query<{ purchase_id: string }>(
    `INSERT INTO public.vendor_subscriptions
       (vendor_id, sku_code, tier, billing_cycle, amount_php, reference_code, period_days, status,
        plan_change_kind, list_price_php, credit_applied_php, credit_carry_forward_php)
     VALUES ($1, $2, $3::public.vendor_tier_state, 'monthly', $4, $5, $6, 'pending_payment', $7, $4, 0, 0)
     RETURNING purchase_id`,
    [vendorId, `${tier}_vendor_monthly`, tier, amount, `SUB-N${seq.toString().padStart(7, '0')}`, periodDays, kind],
  );
  return r.rows[0]!.purchase_id;
}

async function purchase(purchaseId: string) {
  const r = await db.query<{ expires_at: string; period_days: number; status: string }>(
    `SELECT expires_at, period_days, status FROM public.vendor_subscriptions WHERE purchase_id = $1`,
    [purchaseId],
  );
  return r.rows[0]!;
}

async function tierEnd(vendorId: string): Promise<string | null> {
  const r = await db.query<{ e: string | null }>(
    `SELECT to_char(tier_expires_at AT TIME ZONE 'Asia/Manila', 'YYYY-MM-DD HH24:MI') AS e
       FROM public.vendor_profiles WHERE vendor_profile_id = $1`,
    [vendorId],
  );
  return r.rows[0]!.e;
}

/** The same instant on the Manila calendar, one month on — what every check below compares against. */
async function manilaMonthOn(sqlInstant: string): Promise<string> {
  const r = await db.query<{ e: string }>(
    `SELECT to_char((((${sqlInstant}) AT TIME ZONE 'Asia/Manila') + INTERVAL '1 month'), 'YYYY-MM-DD HH24:MI') AS e`,
  );
  return r.rows[0]!.e;
}

test('the one term rule: a calendar month on the Manila calendar, short months clamped', async () => {
  const r = await db.query<Record<string, string>>(
    `SELECT to_char(public.vendor_plan_term_end(t, 'monthly', 28) AT TIME ZONE 'Asia/Manila', 'YYYY-MM-DD HH24:MI') AS e
       FROM unnest(ARRAY['2027-01-31 10:00+08', '2028-01-31 10:00+08', '2027-03-31 08:00+08',
                         '2027-12-15 18:30+08', '2027-02-01 03:00+08']::timestamptz[]) WITH ORDINALITY AS x(t, n)
      ORDER BY n`,
  );
  assert.deepEqual(
    r.rows.map((x) => x.e),
    ['2027-02-28 10:00', '2028-02-29 10:00', '2027-04-30 08:00', '2028-01-15 18:30', '2027-03-01 03:00'],
  );
  // A yearly row bought before yearly retired keeps the day count it was sold with.
  const y = await db.query<{ d: string }>(
    `SELECT EXTRACT(DAY FROM public.vendor_plan_term_end('2027-01-01 00:00+08', 'annual', 365)
                              - '2027-01-01 00:00+08'::timestamptz)::text AS d`,
  );
  assert.equal(y.rows[0]!.d, '365');
});

test('1 · a new monthly order, chosen and approved, runs ONE CALENDAR MONTH — not 28 days', async () => {
  const { vendorId, uid } = await newShop('verified', 'NULL');
  await signIn(uid);
  const o = await db.query<{ purchase_id: string; period_days: number }>(
    `SELECT purchase_id, period_days FROM public.create_vendor_subscription('solo_vendor_monthly', NULL)`,
  );
  await signIn(null);
  const order = o.rows[0]!;
  assert.ok(order.period_days >= 28 && order.period_days <= 31, `the order holds a month's days, got ${order.period_days}`);

  const admin = await newConsoleAdmin();
  await signIn(admin);
  await db.query(`SELECT public.approve_vendor_subscription($1)`, [order.purchase_id]);
  await signIn(null);

  const p = await purchase(order.purchase_id);
  assert.equal(p.status, 'paid');
  // The end is "now, one month on" on the shop's calendar (to the minute: approval and this read are moments apart).
  assert.equal(await tierEnd(vendorId), await manilaMonthOn('now()'));
  // The row's day count is exactly the month it bought, so the credit maths can read the term back.
  const back = await db.query<{ start_minutes_ago: string }>(
    `SELECT EXTRACT(EPOCH FROM (now() - (expires_at - make_interval(days => period_days)))) / 60 AS start_minutes_ago
       FROM public.vendor_subscriptions WHERE purchase_id = $1`,
    [order.purchase_id],
  );
  assert.ok(Math.abs(Number(back.rows[0]!.start_minutes_ago)) < 5, 'expires_at - period_days is the day the term began');
});

test('2 · a renewal from Jan 31 lands on Feb 28, and in a leap year on Feb 29', async () => {
  for (const [from, to, days] of [
    ['2027-01-31 10:00+08', '2027-02-28 10:00', 28],
    ['2028-01-31 10:00+08', '2028-02-29 10:00', 29],
    ['2027-03-31 10:00+08', '2027-04-30 10:00', 30],
    ['2027-07-15 10:00+08', '2027-08-15 10:00', 31],
  ] as const) {
    const { vendorId } = await newShop('solo', `'${from}'::timestamptz`);
    const p = await pendingPurchase(vendorId, 'solo', 'renewal', 1490);
    await db.query(`SELECT public._apply_subscription_credit($1, NULL)`, [p]);
    assert.equal(await tierEnd(vendorId), to, `a month from ${from}`);
    const row = await purchase(p);
    assert.equal(row.period_days, days, `the purchase records the ${days} days its month holds`);
  }
});

test('2b · chained renewals follow the month from the previous end (Jan 31 → Feb 28 → Mar 28)', async () => {
  const { vendorId } = await newShop('solo', `'2027-01-31 10:00+08'::timestamptz`);
  const a = await pendingPurchase(vendorId, 'solo', 'renewal', 1490);
  await db.query(`SELECT public._apply_subscription_credit($1, NULL)`, [a]);
  const b = await pendingPurchase(vendorId, 'solo', 'renewal', 1490);
  await db.query(`SELECT public._apply_subscription_credit($1, NULL)`, [b]);
  assert.equal(await tierEnd(vendorId), '2027-03-28 10:00');
  assert.equal((await purchase(b)).period_days, 28);
});

test('3 · a 28-day term already running KEEPS its end; its renewal adds a month from that end', async () => {
  const { vendorId } = await newShop('solo', "NOW() + INTERVAL '10 days'");
  const old = await paidPurchase(vendorId, 'solo', 1400, 28, "NOW() + INTERVAL '10 days'");
  const before = await tierEnd(vendorId);

  // The sweep runs on every login. A live 28-day term is not touched by it.
  await db.query(`SELECT public.sweep_vendor_tier_expiry($1)`, [vendorId]);
  assert.equal(await tierEnd(vendorId), before, 'the running period ends on the day it was sold');
  assert.equal((await purchase(old)).period_days, 28, 'the paid row is left as it was');

  // Its unused credit is still read over the 28 days it bought: 10 of 28 days left.
  const u = await db.query<{ v: string }>(`SELECT public.vendor_unused_plan_value_php($1) AS v`, [vendorId]);
  assert.ok(Math.abs(Number(u.rows[0]!.v) - (1400 * 10) / 28) < 1, `10/28 of ₱1,400, got ${u.rows[0]!.v}`);

  // The renewal (ordered before the change or after: either way it is a renewal) starts at that end.
  const r = await pendingPurchase(vendorId, 'solo', 'renewal', 1490);
  await db.query(`SELECT public._apply_subscription_credit($1, NULL)`, [r]);
  assert.equal(await tierEnd(vendorId), await manilaMonthOn("now() + INTERVAL '10 days'"));
  assert.equal((await purchase(old)).period_days, 28, 'renewing never rewrites the term before it');
});

test('4 · the unused credit of a month-long term is read over the month it holds', async () => {
  // A 31-day month with 15.5 days left is worth half; read over 28 days it would wrongly be worth 55%.
  const { vendorId } = await newShop('solo', "NOW() + INTERVAL '15 days 12 hours'");
  await paidPurchase(vendorId, 'solo', 1490, 31, "NOW() + INTERVAL '15 days 12 hours'");
  const u = await db.query<{ v: string }>(`SELECT public.vendor_unused_plan_value_php($1) AS v`, [vendorId]);
  assert.ok(Math.abs(Number(u.rows[0]!.v) - 745) < 1, `half of ₱1,490, got ${u.rows[0]!.v}`);

  // And an UPGRADE out of it starts a fresh calendar month, whose row reads back to today.
  const up = await pendingPurchase(vendorId, 'pro', 'upgrade', 4990);
  await db.query(`SELECT public._apply_subscription_credit($1, NULL)`, [up]);
  assert.equal(await tierEnd(vendorId), await manilaMonthOn('now()'));
  const back = await db.query<{ m: string }>(
    `SELECT EXTRACT(EPOCH FROM (now() - (expires_at - make_interval(days => period_days)))) / 60 AS m
       FROM public.vendor_subscriptions WHERE purchase_id = $1`,
    [up],
  );
  assert.ok(Math.abs(Number(back.rows[0]!.m)) < 5, 'the upgrade term reads back as starting today');
});

test('5 · a paid scheduled plan lands at term end for a calendar month, and its purchase records it', async () => {
  const { vendorId } = await newShop('pro', "NOW() + INTERVAL '20 days'");
  const p = await pendingPurchase(vendorId, 'solo', 'downgrade', 1490);
  await db.query(`SELECT public._apply_subscription_credit($1, NULL)`, [p]);
  await db.query(
    `UPDATE public.vendor_profiles SET tier_expires_at = NOW() - INTERVAL '1 minute' WHERE vendor_profile_id = $1`,
    [vendorId],
  );
  await db.query(`SELECT public.sweep_vendor_tier_expiry($1)`, [vendorId]);
  const t = await db.query<{ tier_state: string }>(
    `SELECT tier_state::text FROM public.vendor_profiles WHERE vendor_profile_id = $1`,
    [vendorId],
  );
  assert.equal(t.rows[0]!.tier_state, 'solo');
  assert.equal(await tierEnd(vendorId), await manilaMonthOn('now()'));
  const row = await purchase(p);
  assert.ok(row.expires_at, 'the purchase records the term it bought');
  assert.ok(row.period_days >= 28 && row.period_days <= 31, `and the days of that month, got ${row.period_days}`);
});

test('6 · "cover the time you already have" is month-shaped: exactly a month left is allowed', async () => {
  const { vendorId, uid } = await newShop('solo', 'NULL');
  // One transaction, so now() is frozen and the expiry sits exactly on the boundary.
  await db.exec('BEGIN');
  await db.query(
    `UPDATE public.vendor_profiles SET tier_expires_at = public.vendor_plan_term_end(now(), 'monthly', NULL)
      WHERE vendor_profile_id = $1`,
    [vendorId],
  );
  await signIn(uid);
  await db.query(`SELECT public.create_vendor_subscription('solo_vendor_monthly', NULL)`);
  await db.exec('COMMIT');
  await signIn(null);
  const n = await db.query<{ c: string }>(
    `SELECT count(*)::text AS c FROM public.vendor_subscriptions WHERE vendor_id = $1`,
    [vendorId],
  );
  assert.equal(n.rows[0]!.c, '1', 'a month-long renewal with exactly a month left must be allowed');
});

test('6b · an hour more than a month left IS refused', async () => {
  const { uid } = await newShop('solo', `public.vendor_plan_term_end(now(), 'monthly', NULL) + INTERVAL '1 hour'`);
  await signIn(uid);
  await assert.rejects(
    () => db.query(`SELECT public.create_vendor_subscription('solo_vendor_monthly', NULL)`),
    /TERM_TOO_SHORT/,
  );
  await signIn(null);
});

test('7 · the monthly plans are named "monthly", never "4 weeks"', async () => {
  const r = await db.query<{ sku_code: string; title: string }>(
    `SELECT sku_code, title FROM public.vendor_billing_catalog
      WHERE sku_code IN ('solo_vendor_monthly','pro_vendor_monthly','enterprise_vendor_monthly') ORDER BY sku_code`,
  );
  assert.deepEqual(
    r.rows.map((x) => x.title),
    ['Ultra (monthly)', 'Pro (monthly)', 'Plus (monthly)'],
  );
});

test('the term rule is internal: no signed-in or anonymous caller may run it', async () => {
  const r = await db.query<{ anon: boolean; authed: boolean }>(
    `SELECT has_function_privilege('anon', 'public.vendor_plan_term_end(timestamptz,text,int)', 'EXECUTE') AS anon,
            has_function_privilege('authenticated', 'public.vendor_plan_term_end(timestamptz,text,int)', 'EXECUTE') AS authed`,
  );
  assert.equal(r.rows[0]!.anon, false);
  assert.equal(r.rows[0]!.authed, false);
});
