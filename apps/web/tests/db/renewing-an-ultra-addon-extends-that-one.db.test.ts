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

// ── Review defects (20 Nov, rulings-builder stop report) ─────────────────────────────────────────────────────────────

async function dueIds(): Promise<string[]> {
  const due = await db.query<{ order_id: string }>(`SELECT order_id FROM public.subscriptions_due_for_renewal_reminder(7)`);
  return due.rows.map((r) => r.order_id);
}

test('a renewal clears THAT add-on’s reminder lock, so it is reminded again before its NEW end (and no other add-on’s)', async () => {
  const s = await newShop('remind-again');
  const a = await order(s, addOnKey(s.shop), 'paid', 3);
  const b = await order(s, addOnKey(s.shop), 'paid', 4);
  // The daily job reminded both (the lock row runRenewalReminders writes).
  assert.ok((await dueIds()).includes(a));
  await db.query(`INSERT INTO public.renewal_reminder_log (order_id, reminder_window) VALUES ($1, '7d'), ($2, '7d')`, [a, b]);
  assert.ok(!(await dueIds()).includes(a), 'reminded once per window');

  const renewal = await order(s, ultraAddOnRenewalServiceKey(a), 'paid', null);
  await db.query(`SELECT public.ultra_addon_apply_renewal($1)`, [renewal]);
  const locks = await db.query<{ order_id: string }>(
    `SELECT order_id FROM public.renewal_reminder_log WHERE order_id IN ($1, $2)`,
    [a, b],
  );
  assert.deepEqual(locks.rows.map((r) => r.order_id), [b], 'A’s lock is gone, B’s stays');

  // 25 days later A is inside its 7-day window again → reminded again.
  await db.query(`UPDATE public.orders SET expires_at = now() + interval '3 days' WHERE order_id = $1`, [a]);
  assert.ok((await dueIds()).includes(a), 'the renewed add-on is reminded again');
  assert.ok(!(await dueIds()).includes(b), 'B is still reminded only once');
});

test('refunds out of order: refunding the FIRST of two renewals takes its 28 days back and shifts the later mark down', async () => {
  const s = await newShop('out-of-order');
  const a = await order(s, addOnKey(s.shop), 'paid', 10);
  const a0 = (await endsAt(a))!;
  const r1 = await order(s, ultraAddOnRenewalServiceKey(a), 'paid', null);
  await db.query(`SELECT public.ultra_addon_apply_renewal($1)`, [r1]);
  const r2 = await order(s, ultraAddOnRenewalServiceKey(a), 'paid', null);
  await db.query(`SELECT public.ultra_addon_apply_renewal($1)`, [r2]);
  assert.equal((await endsAt(a))! - a0, 56 * DAY, 'two renewals → +56 days');
  assert.equal(await endsAt(r2), await endsAt(a), 'R2’s mark is A’s end');

  // R1 is refunded first (A now ends past R1's mark, where R2 put it).
  await db.query(`UPDATE public.orders SET status = 'refunded' WHERE order_id = $1`, [r1]);
  await db.query(`SELECT public.ultra_addon_reverse_renewal($1)`, [r1]);
  assert.equal((await endsAt(a))! - a0, 28 * DAY, 'R1’s 28 days are taken back even though R2 came after');
  assert.equal(await endsAt(r1), null, 'R1’s marker cleared');
  assert.equal(await endsAt(r2), await endsAt(a), 'R2’s mark moved down with A, so R2 can still be undone exactly');

  // Then R2 is refunded too → A ends where it started.
  await db.query(`UPDATE public.orders SET status = 'refunded' WHERE order_id = $1`, [r2]);
  await db.query(`SELECT public.ultra_addon_reverse_renewal($1)`, [r2]);
  assert.equal(await endsAt(a), a0, 'both refunded → A is back to its own end');

  // A second reverse of the same renewal changes nothing.
  await db.query(`SELECT public.ultra_addon_reverse_renewal($1)`, [r1]);
  assert.equal(await endsAt(a), a0);
});

test('a refund takes nothing back when the add-on already ends BEFORE that renewal’s mark (it was shortened since)', async () => {
  const s = await newShop('shortened');
  const a = await order(s, addOnKey(s.shop), 'paid', 10);
  const r1 = await order(s, ultraAddOnRenewalServiceKey(a), 'paid', null);
  await db.query(`SELECT public.ultra_addon_apply_renewal($1)`, [r1]);
  await db.query(`UPDATE public.orders SET expires_at = expires_at - interval '5 days' WHERE order_id = $1`, [a]);
  const before = await endsAt(a);
  await db.query(`UPDATE public.orders SET status = 'refunded' WHERE order_id = $1`, [r1]);
  await db.query(`SELECT public.ultra_addon_reverse_renewal($1)`, [r1]);
  assert.equal(await endsAt(a), before, 'end < mark → left alone');
});

// ── Round 4 (20 Nov): the rest of the controller's refund cases, and a reversal that can no longer be silent ─────────

async function refund(renewalId: string): Promise<boolean | null> {
  await db.query(`UPDATE public.orders SET status = 'refunded' WHERE order_id = $1`, [renewalId]);
  const r = await db.query<{ took: boolean | null }>(`SELECT public.ultra_addon_reverse_renewal($1) AS took`, [renewalId]);
  return r.rows[0]!.took;
}

test('refunding the LATEST renewal takes back its 28 days and leaves the earlier renewal’s mark where it is', async () => {
  const s = await newShop('latest');
  const a = await order(s, addOnKey(s.shop), 'paid', 10);
  const a0 = (await endsAt(a))!;
  const r1 = await order(s, ultraAddOnRenewalServiceKey(a), 'paid', null);
  await db.query(`SELECT public.ultra_addon_apply_renewal($1)`, [r1]);
  const r1Mark = (await endsAt(r1))!;
  const r2 = await order(s, ultraAddOnRenewalServiceKey(a), 'paid', null);
  await db.query(`SELECT public.ultra_addon_apply_renewal($1)`, [r2]);

  assert.equal(await refund(r2), true, 'the reversal says it took the 28 days back');
  assert.equal((await endsAt(a))! - a0, 28 * DAY, 'only R2’s 28 days are gone');
  assert.equal(await endsAt(r1), r1Mark, 'R1’s mark is untouched (it came earlier)');
  assert.equal(await endsAt(a), r1Mark, 'A ends at R1’s mark again');

  assert.equal(await refund(r1), true);
  assert.equal(await endsAt(a), a0, 'both refunded → A is back to its own end');
});

test('a refund after the add-on has already ended takes the 28 days back once, opens no live window, and reports it', async () => {
  const s = await newShop('ended');
  const a = await order(s, addOnKey(s.shop), 'paid', 10);
  const r = await order(s, ultraAddOnRenewalServiceKey(a), 'paid', null);
  await db.query(`SELECT public.ultra_addon_apply_renewal($1)`, [r]);
  // Time passes: the add-on (and so the renewal's mark) is 3 days in the past.
  await db.query(`UPDATE public.orders SET expires_at = now() - interval '3 days' WHERE order_id IN ($1, $2)`, [a, r]);
  const ended = (await endsAt(a))!;
  assert.equal(await liveCount(s.shop), 0);

  assert.equal(await refund(r), true);
  assert.equal((await endsAt(a))!, ended - 28 * DAY, 'its 28 days come off the end it set, never off today');
  assert.equal(await liveCount(s.shop), 0, 'no live add-on appears');
  assert.ok(!(await dueIds()).includes(a), 'and nothing is reminded');

  // Taken once only: a second reversal of the same refund changes nothing.
  assert.equal(await refund(r), null, 'already undone → nothing to undo');
  assert.equal((await endsAt(a))!, ended - 28 * DAY);
});

test('a refund that takes nothing back says so (false), so the hook can report it instead of looking like success', async () => {
  const s = await newShop('says-so');
  const a = await order(s, addOnKey(s.shop), 'paid', 10);
  const r = await order(s, ultraAddOnRenewalServiceKey(a), 'paid', null);
  await db.query(`SELECT public.ultra_addon_apply_renewal($1)`, [r]);
  await db.query(`UPDATE public.orders SET expires_at = expires_at - interval '5 days' WHERE order_id = $1`, [a]);
  assert.equal(await refund(r), false, 'applied, but A ends before its mark → nothing taken, and it says so');
  const never = await order(s, ultraAddOnRenewalServiceKey(a), 'submitted', null);
  assert.equal(await refund(never), null, 'never applied → nothing to undo');
});

test('two add-ons on one shop stay independent through renewals and out-of-order refunds', async () => {
  const s = await newShop('independent');
  const a = await order(s, addOnKey(s.shop), 'paid', 5);
  const b = await order(s, addOnKey(s.shop), 'paid', 9);
  const a0 = (await endsAt(a))!;
  const b0 = (await endsAt(b))!;
  const ra1 = await order(s, ultraAddOnRenewalServiceKey(a), 'paid', null);
  await db.query(`SELECT public.ultra_addon_apply_renewal($1)`, [ra1]);
  const rb = await order(s, ultraAddOnRenewalServiceKey(b), 'paid', null);
  await db.query(`SELECT public.ultra_addon_apply_renewal($1)`, [rb]);
  const ra2 = await order(s, ultraAddOnRenewalServiceKey(a), 'paid', null);
  await db.query(`SELECT public.ultra_addon_apply_renewal($1)`, [ra2]);
  const rbMark = (await endsAt(rb))!;
  // B's renewal mark lies AFTER A's first renewal's mark — a shift keyed on the shop (not the add-on) would move it.
  assert.ok(rbMark > (await endsAt(ra1))!);
  assert.equal(await liveCount(s.shop), 2);

  // A's reminder lock and B's, then refund A's FIRST renewal.
  await db.query(`INSERT INTO public.renewal_reminder_log (order_id, reminder_window) VALUES ($1, '7d'), ($2, '7d')`, [a, b]);
  assert.equal(await refund(ra1), true);
  assert.equal((await endsAt(a))! - a0, 28 * DAY, 'A loses exactly R1’s 28 days');
  assert.equal(await endsAt(ra2), await endsAt(a), 'A’s later renewal mark shifts with A');
  assert.equal(await endsAt(b), b0 + 28 * DAY, 'B keeps its own renewal');
  assert.equal(await endsAt(rb), rbMark, 'B’s renewal mark is never shifted by A’s refund');
  const locks = await db.query<{ order_id: string }>(
    `SELECT order_id FROM public.renewal_reminder_log WHERE order_id IN ($1, $2)`,
    [a, b],
  );
  assert.deepEqual(locks.rows.map((r) => r.order_id), [b], 'only A’s reminder lock is cleared');

  assert.equal(await refund(rb), true);
  assert.equal(await endsAt(b), b0, 'B back to its own end');
  assert.equal((await endsAt(a))! - a0, 28 * DAY, 'A unchanged by B’s refund');
  assert.equal(await liveCount(s.shop), 2, 'still two add-ons throughout');
});
