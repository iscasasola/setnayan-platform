/**
 * THE SEALS ARE COUNTED RIGHT, AND GIVEN ONCE (test:db) — the badge build, J2 (migration 20271348504364).
 *
 * The yearly seals rank shops against each other, so a wrong count gives one shop's seal to another. Each case is a
 * way the counts or the table could be wrong:
 *   · shop_seal_year_facts: only delivered/complete, only events dated in the year, never archived, fraud, a self-
 *     booking or a demo shop; a refunded completed booking is counted as refunded; a schedule-pool release
 *     'vendor_cancelled' is a shop cancellation; inquiries are chat threads opened in the year;
 *   · shop_verified_partner_facts: the booking total, each found-through channel, Booking QR read from the claimed
 *     token, recommenders = accepted + active partnerships only;
 *   · shop_seals: once per shop + seal + year; Verified Partner once per shop for life; one No. 1 a year; no
 *     'verified' row (Verified is read live); a session cannot write;
 *   · both functions are service_role only.
 *
 * Run: pnpm --filter @setnayan/web test:db
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';

import { createReplayedDb, type ReplayResult } from './replay-migrations';

let replay: ReplayResult;
let db: ReplayResult['db'];
let n = 0;

async function newUser(type = 'customer'): Promise<string> {
  n += 1;
  const u = await db.query<{ id: string }>(
    `INSERT INTO auth.users (email, raw_user_meta_data)
     VALUES ($1, jsonb_build_object('account_type',$2::text)) RETURNING id`,
    [`seal-${n}@seals.test`, type],
  );
  return u.rows[0]!.id;
}
async function newShop(opts: { demo?: boolean } = {}): Promise<{ vpid: string; owner: string }> {
  const owner = await newUser('vendor');
  const v = await db.query<{ vendor_profile_id: string }>(
    `INSERT INTO public.vendor_profiles
       (user_id, business_name, location_city, services, verification_state, last_verified_at, public_visibility, is_demo)
     VALUES ($1, 'Seal Co', 'Manila', ARRAY['photography']::text[], 'verified', NOW(), 'verified', $2)
     ON CONFLICT (user_id) DO UPDATE
       SET verification_state = EXCLUDED.verification_state, last_verified_at = EXCLUDED.last_verified_at,
           public_visibility = EXCLUDED.public_visibility, is_demo = EXCLUDED.is_demo
     RETURNING vendor_profile_id`,
    [owner, !!opts.demo],
  );
  return { vpid: v.rows[0]!.vendor_profile_id, owner };
}
async function newEvent(date: string, ...couple: string[]): Promise<string> {
  return newEventOf(date, false, ...couple);
}
async function newEventOf(date: string, sample: boolean, ...couple: string[]): Promise<string> {
  const e = await db.query<{ event_id: string }>(
    `INSERT INTO public.events (display_name, event_type, event_date, event_date_precision, is_sample)
     VALUES ('Seal event', 'birthday', $1::date, 'day', $2) RETURNING event_id`,
    [date, sample],
  );
  const eventId = e.rows[0]!.event_id;
  for (const uid of couple) {
    await db.query(`INSERT INTO public.event_members (event_id, user_id, member_type) VALUES ($1, $2, 'couple')`, [eventId, uid]);
  }
  return eventId;
}
async function book(
  eventId: string,
  vpid: string,
  opts: { status?: string; source?: string; total?: number; archived?: boolean; fraud?: boolean } = {},
): Promise<string> {
  const r = await db.query<{ vendor_id: string }>(
    `INSERT INTO public.event_vendors (event_id, category, vendor_name, status, marketplace_vendor_id, source, total_cost_php)
     VALUES ($1, 'photographer', 'Seal Co', $2::public.vendor_status, $3, $4, $5) RETURNING vendor_id`,
    [eventId, opts.status ?? 'complete', vpid, opts.source ?? null, opts.total ?? null],
  );
  const id = r.rows[0]!.vendor_id;
  if (opts.archived || opts.fraud) {
    await db.query(
      `UPDATE public.event_vendors SET archived_at = CASE WHEN $2 THEN now() ELSE archived_at END, voided_by_fraud = $3 WHERE vendor_id = $1`,
      [id, !!opts.archived, !!opts.fraud],
    );
  }
  return id;
}
type YearRow = { completed_events: number; refunded_events: number; shop_cancellations: number; inquiries: number };
async function yearFacts(year: number, vpid: string): Promise<YearRow | null> {
  const r = await db.query<YearRow>(
    `SELECT completed_events, refunded_events, shop_cancellations, inquiries
       FROM public.shop_seal_year_facts($1) WHERE vendor_profile_id = $2`,
    [year, vpid],
  );
  return r.rows[0] ?? null;
}

before(async () => {
  replay = await createReplayedDb();
  db = replay.db;
});
after(async () => {
  await db?.close();
});

test('a year counts only completed bookings on events dated in that year — never archived, fraud or a self-booking', async () => {
  const { vpid, owner } = await newShop();
  const c = await newUser();
  await book(await newEvent('2026-03-01', c), vpid);
  await book(await newEvent('2026-07-01', c), vpid, { status: 'delivered' });
  await book(await newEvent('2026-08-01', c), vpid, { status: 'contracted' });
  await book(await newEvent('2027-01-02', c), vpid);
  await book(await newEvent('2026-09-01', c), vpid, { archived: true });
  await book(await newEvent('2026-10-01', c), vpid, { fraud: true });
  await book(await newEvent('2026-11-01', owner), vpid);
  const f = await yearFacts(2026, vpid);
  assert.equal(f?.completed_events, 2, 'complete + delivered in 2026 only');
  assert.equal((await yearFacts(2027, vpid))?.completed_events, 1);
});

test('a refunded completed booking is counted as refunded; a vendor_cancelled release is a shop cancellation', async () => {
  const { vpid } = await newShop();
  const c = await newUser();
  const evId = await newEvent('2026-05-05', c);
  const bookingId = await book(evId, vpid);
  await db.query(
    `INSERT INTO public.event_vendor_refunds (event_id, event_vendor_id, vendor_profile_id, amount_php, refunded_on, reason)
     VALUES ($1, $2, $3, 1000, '2026-05-10', 'Test refund')`,
    [evId, bookingId, vpid],
  );
  const pool = await db.query<{ pool_id: string }>(
    `INSERT INTO public.vendor_schedule_pools (vendor_profile_id, pool_label) VALUES ($1, 'Pool') RETURNING pool_id`,
    [vpid],
  );
  {
    await db.query(
      `INSERT INTO public.vendor_schedule_pool_bookings
         (pool_id, vendor_profile_id, event_vendor_id, event_id, booked_date, released_at, release_reason)
       VALUES ($1, $2, $3, $4, '2026-05-05', '2026-06-01', 'vendor_cancelled')`,
      [pool.rows[0]!.pool_id, vpid, bookingId, evId],
    );
  }
  const f = await yearFacts(2026, vpid);
  assert.equal(f?.completed_events, 1);
  assert.equal(f?.refunded_events, 1);
  assert.equal(f?.shop_cancellations, 1);
});

test('inquiries are threads opened in the year; a demo shop is never in the yearly facts', async () => {
  const real = await newShop();
  const c = await newUser();
  const e1 = await newEvent('2026-02-02', c);
  const e2 = await newEvent('2026-03-03', c);
  await db.query(`INSERT INTO public.chat_threads (event_id, vendor_profile_id, created_at) VALUES ($1, $3, '2026-04-01'), ($2, $3, '2025-12-31')`, [
    e1,
    e2,
    real.vpid,
  ]);
  assert.equal((await yearFacts(2026, real.vpid))?.inquiries, 1, 'only the thread opened in 2026');

  const demo = await newShop({ demo: true });
  await book(await newEventOf('2026-02-02', true, c), demo.vpid);
  assert.equal(await yearFacts(2026, demo.vpid), null, 'a demo shop never competes for a seal');
});

test('the Verified Partner counters read every channel, the Booking QR token, and accepted partners only', async () => {
  const { vpid } = await newShop();
  const c = await newUser();
  await book(await newEvent('2026-01-01', c), vpid, { source: 'host_marketplace_search', total: 400_000 });
  await book(await newEvent('2026-01-02', c), vpid, { source: 'explore', total: 100_000 });
  await book(await newEvent('2026-01-03', c), vpid, { source: 'shop_page', total: 250_000 });
  await book(await newEvent('2026-01-04', c), vpid, { source: 'website' });
  const qrBooking = await book(await newEvent('2026-01-05', c), vpid, { source: 'vendor_invite', total: 250_000 });
  await book(await newEvent('2026-01-06', c), vpid, { source: 'explore', status: 'considering', total: 9_999_999 });

  const r = await db.query<Record<string, string | number>>(`SELECT * FROM public.shop_verified_partner_facts($1)`, [vpid]);
  const f = r.rows[0]!;
  assert.equal(Number(f.booked_total_php), 1_000_000, 'only real bookings add to the total');
  assert.equal(Number(f.bookings_unpriced), 1);
  assert.equal(Number(f.find_bookings), 2);
  assert.equal(Number(f.website_bookings), 2);
  assert.equal(Number(f.qr_import_bookings), 1);
  assert.equal(Number(f.booking_qr_events), 0);

  // A claimed Booking QR token whose booking is real counts its event — read from the token, whatever `source` says.
  const { owner } = await db
    .query<{ owner: string }>(`SELECT user_id AS owner FROM public.vendor_profiles WHERE vendor_profile_id = $1`, [vpid])
    .then((x) => x.rows[0]!);
  await db.query(
    `INSERT INTO public.vendor_locked_qr_tokens (token, vendor_profile_id, created_by_user_id, category, claimed_event_vendor_id)
     VALUES ('seal-qr-1', $1, $2, 'photographer', $3)`,
    [vpid, owner, qrBooking],
  );
  const q = await db.query<{ n: number }>(`SELECT booking_qr_events AS n FROM public.shop_verified_partner_facts($1)`, [vpid]);
  assert.equal(Number(q.rows[0]!.n), 1);
  assert.equal(Number(f.recommenders), 0);

  const other = await newShop();
  const third = await newShop();
  // A partnership needs the two shops to have served one event together (NOT_SERVED_TOGETHER).
  const shared = await newEvent('2026-02-01', c);
  await book(shared, vpid, { status: 'contracted' });
  await book(shared, other.vpid, { status: 'contracted' });
  await book(shared, third.vpid, { status: 'contracted' });
  await db.query(
    `INSERT INTO public.vendor_partnerships (recommending_vendor_id, recommended_vendor_id, relationship_type, status, is_active)
     VALUES ($1, $3, 'general', 'accepted', true), ($2, $3, 'general', 'proposed', true)`,
    [other.vpid, third.vpid, vpid],
  );
  const r2 = await db.query<{ recommenders: number }>(`SELECT recommenders FROM public.shop_verified_partner_facts($1)`, [vpid]);
  assert.equal(Number(r2.rows[0]!.recommenders), 1, 'a proposed partnership is not a recommendation');
});

test('shop_seals: once per shop + seal + year, Verified Partner once for life, one No. 1 a year, no Verified row', async () => {
  const a = await newShop();
  const b = await newShop();
  await db.query(`INSERT INTO public.shop_seals (vendor_profile_id, seal, award_year) VALUES ($1, 'top10', 2026)`, [a.vpid]);
  await assert.rejects(
    db.query(`INSERT INTO public.shop_seals (vendor_profile_id, seal, award_year) VALUES ($1, 'top10', 2026)`, [a.vpid]),
    'the same seal twice in one year',
  );
  await db.query(`INSERT INTO public.shop_seals (vendor_profile_id, seal, award_year) VALUES ($1, 'top10', 2027)`, [a.vpid]);

  await db.query(`INSERT INTO public.shop_seals (vendor_profile_id, seal, award_year) VALUES ($1, 'verified_partner', 2026)`, [a.vpid]);
  await assert.rejects(
    db.query(`INSERT INTO public.shop_seals (vendor_profile_id, seal, award_year) VALUES ($1, 'verified_partner', 2028)`, [a.vpid]),
    'Verified Partner is kept for life — never given twice',
  );

  await db.query(`INSERT INTO public.shop_seals (vendor_profile_id, seal, award_year) VALUES ($1, 'no1', 2026)`, [a.vpid]);
  await assert.rejects(
    db.query(`INSERT INTO public.shop_seals (vendor_profile_id, seal, award_year) VALUES ($1, 'no1', 2026)`, [b.vpid]),
    'one No. 1 a year',
  );
  await assert.rejects(
    db.query(`INSERT INTO public.shop_seals (vendor_profile_id, seal, award_year) VALUES ($1, 'verified', 2026)`, [b.vpid]),
    'Setnayan Verified is read live, never stored',
  );
  // No. 1's free plan year is recorded owed on the No. 1 row — and only there.
  await db.query(`UPDATE public.shop_seals SET plan_gift_state = 'owed' WHERE vendor_profile_id = $1 AND seal = 'no1'`, [a.vpid]);
  await assert.rejects(
    db.query(`INSERT INTO public.shop_seals (vendor_profile_id, seal, award_year, plan_gift_state) VALUES ($1, 'top10', 2030, 'owed')`, [b.vpid]),
    'only No. 1 carries the free plan year',
  );
});

test('shop_seals has RLS, and a signed-in session cannot write it', async () => {
  const rls = await db.query<{ relrowsecurity: boolean }>(`SELECT relrowsecurity FROM pg_class WHERE oid = 'public.shop_seals'::regclass`);
  assert.equal(rls.rows[0]!.relrowsecurity, true);
  const pol = await db.query<{ polname: string; polcmd: string }>(
    `SELECT polname, polcmd::text AS polcmd FROM pg_policy WHERE polrelid = 'public.shop_seals'::regclass ORDER BY polname`,
  );
  assert.deepEqual(
    pol.rows.map((p) => p.polname),
    ['shop_seals_admin_write', 'shop_seals_own_read'],
    'reads: the shop itself or an admin; writes: admin only',
  );
});

test('both counting functions are service_role only', async () => {
  for (const fn of ['public.shop_seal_year_facts(integer)', 'public.shop_verified_partner_facts(uuid)']) {
    const r = await db.query<{ role: string; ok: boolean }>(
      `SELECT r AS role, has_function_privilege(r, $1, 'EXECUTE') AS ok FROM unnest(ARRAY['anon','authenticated','service_role']) AS r`,
      [fn],
    );
    assert.deepEqual(Object.fromEntries(r.rows.map((x) => [x.role, x.ok])), { anon: false, authenticated: false, service_role: true }, fn);
  }
});
