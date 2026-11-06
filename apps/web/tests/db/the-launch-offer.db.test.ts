/**
 * THE LAUNCH OFFER — the first N Setnayan-sourced bookings are fee-free.
 *
 * ⚖ Owner 2026-10-08 (the offer) and 2026-10-12 #3–#7 (how it counts, free-5,
 * free Pro's end, the 50 credits, no gift). Migration 20271268832636.
 *
 * Money code, executed against replayed migrations — every rule asserted on a
 * real charge, not on a reading of the function:
 *   1. the owner's numbers are seeded and the offer is OFF until started;
 *   2. while open, a sourced booking is `waived_launch` at ₱0, records what it
 *      would have cost, takes NO free-5 place, and grants the credits once;
 *   3. the cap-th booking is free and closes the offer, stamping free Pro's end;
 *      the next is decided as normal — and a shop that had launch bookings
 *      still has its full five;
 *   4. imports are never counted; a second call reuses, never re-counts;
 *   5. free Pro's end: SQL and TS agree on one table of cases;
 *   6. the quote promises no gift while the offer is open; the date is held;
 *      an amendment never re-bills a launch booking.
 *
 * SABOTAGE (2026-10-12): move the launch arm BELOW the ordinal block → test 2
 * RED (a launch booking took free-5 ordinal 1); drop `AND NOT l2.launch_offer`
 * from the ordinal count → test 3 RED (the shop's first billed-era booking is
 * ordinal 3, not 1).
 */
import { test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import type { PGlite } from '@electric-sql/pglite';
import { createReplayedDb, type ReplayResult } from './replay-migrations';
import { LAUNCH_PRO_END_CASES, launchProEndsAt } from '../../lib/launch-offer';
import { FEE_SETTLED_STATUSES } from '../../lib/event-access-stage';
import { WAIVED_FEE_RECEIPT_STATUSES } from '../../lib/booking-fee-disclosure';

let replay: ReplayResult;
let db: PGlite;
/** platform_settings exactly as the migrations left it — read before any test edits it. */
let seeded: { enabled: boolean | null; cap: number | null; credits: number | null; cycle: number | null };
before(async () => {
  replay = await createReplayedDb();
  db = replay.db;
  seeded = (
    await db.query<typeof seeded>(
      `SELECT launch_offer_enabled AS enabled, launch_offer_booking_cap AS cap,
              launch_offer_papic_credits AS credits, launch_offer_cycle_days AS cycle
         FROM public.platform_settings WHERE id = 1`,
    )
  ).rows[0]!;
});
after(async () => {
  await db?.close();
});
beforeEach(async () => {
  // Each test starts from a clean, un-started offer with the owner's numbers.
  await db.query(`UPDATE public.booking_fee_ledger SET launch_offer = FALSE, launch_offer_number = NULL`);
  await db.query(
    `UPDATE public.platform_settings
        SET launch_offer_enabled = NULL, launch_offer_started_at = NULL,
            launch_offer_closed_at = NULL, launch_offer_pro_ends_at = NULL,
            launch_offer_booking_cap = 2000, launch_offer_papic_credits = 50,
            launch_offer_cycle_days = 28,
            booking_fee_free_from = NULL, booking_fee_free_until = NULL
      WHERE id = 1`,
  );
});

let seq = 0;
const uniq = () => `launch-${++seq}-${Date.now()}`;

async function startOffer(cap: number): Promise<void> {
  await db.query(
    `UPDATE public.platform_settings
        SET launch_offer_enabled = TRUE, launch_offer_started_at = NOW() - INTERVAL '1 day',
            launch_offer_booking_cap = $1
      WHERE id = 1`,
    [cap],
  );
}

async function newVendor(): Promise<string> {
  const u = await db.query<{ id: string }>(
    `INSERT INTO auth.users (email, raw_user_meta_data)
     VALUES ($1, jsonb_build_object('account_type','customer')) RETURNING id`,
    [`${uniq()}@t.local`],
  );
  const v = await db.query<{ vendor_profile_id: string }>(
    `INSERT INTO public.vendor_profiles
       (user_id, business_name, location_city, services, verification_state, last_verified_at)
     VALUES ($1,'Launch Studio','Manila',ARRAY['photography']::text[],'verified',NOW())
     RETURNING vendor_profile_id`,
    [u.rows[0]!.id],
  );
  return v.rows[0]!.vendor_profile_id;
}

async function newBooking(vpid: string, opts: { sourced?: boolean; status?: string; serviceId?: string } = {}) {
  const e = await db.query<{ event_id: string }>(
    `INSERT INTO public.events (display_name, event_type, event_date)
     VALUES ('A celebration','birthday','2030-07-01') RETURNING event_id`,
  );
  const eventId = e.rows[0]!.event_id;
  const ev = await db.query<{ vendor_id: string }>(
    `INSERT INTO public.event_vendors
       (event_id, category, vendor_name, status, marketplace_vendor_id, total_cost_php, service_id)
     VALUES ($1,'photographer','Launch Studio',$2::vendor_status,$3,50000,$4) RETURNING vendor_id`,
    [eventId, opts.status ?? 'contracted', vpid, opts.serviceId ?? null],
  );
  if (opts.sourced !== false) {
    await db.query(
      `INSERT INTO public.chat_threads (event_id, vendor_profile_id, inquiry_source)
       VALUES ($1, $2, 'explore')`,
      [eventId, vpid],
    );
  }
  return { eventId, eventVendorId: ev.rows[0]!.vendor_id };
}

type Open = {
  charge_id?: string;
  status?: string;
  booking_ordinal?: number | null;
  computed_fee_centavos?: number;
  amount_charged_centavos?: number;
  launch_offer_number?: number | null;
  reused?: boolean;
};
async function openCharge(evId: string): Promise<Open> {
  const r = await db.query<{ r: Open }>(`SELECT public.booking_fee_open_lock_charge($1) AS r`, [evId]);
  return r.rows[0]!.r;
}

const settings = async () =>
  (
    await db.query<{ closed: Date | null; pro: Date | null; started: Date | null }>(
      `SELECT launch_offer_closed_at AS closed, launch_offer_pro_ends_at AS pro,
              launch_offer_started_at AS started
         FROM public.platform_settings WHERE id = 1`,
    )
  ).rows[0]!;

const credits = async (chargeId: string) =>
  (
    await db.query<{ credits: number; source: string }>(
      `SELECT credits, source FROM public.vendor_papic_portfolio_credit_grants WHERE booking_fee_charge_id = $1`,
      [chargeId],
    )
  ).rows;

/* ── 1 ────────────────────────────────────────────────────────────────── */

test('1 · the owner’s numbers are seeded and the offer is OFF until started', async () => {
  // The owner's figures (2026-10-08 / 2026-10-12), seeded by the migration.
  assert.deepEqual(
    seeded,
    { enabled: null, cap: 2000, credits: 50, cycle: 28 },
    'the migration did not seed the owner’s numbers, or switched the offer on by itself',
  );

  const vpid = await newVendor();
  const b = await newBooking(vpid);
  const o = await openCharge(b.eventVendorId);
  assert.equal(o.status, 'waived_free5', 'with the offer off, a first booking is the shop’s own free one');
  const open = await db.query<{ o: boolean }>(`SELECT public.booking_fee_launch_offer_open() AS o`);
  assert.equal(open.rows[0]!.o, false);
});

/* ── 2 ────────────────────────────────────────────────────────────────── */

test('2 · while open, a sourced booking is waived_launch, takes no free-5 place, and grants 50 credits once', async () => {
  await startOffer(2000);
  const vpid = await newVendor();
  const b = await newBooking(vpid);
  const o = await openCharge(b.eventVendorId);
  assert.equal(o.status, 'waived_launch', JSON.stringify(o));
  assert.equal(o.amount_charged_centavos, 0, 'a launch booking billed money');
  assert.ok((o.computed_fee_centavos ?? 0) > 0, 'what it WOULD have cost is not recorded');
  assert.equal(o.booking_ordinal, null, 'a launch booking took one of the shop’s five');
  assert.equal(o.launch_offer_number, 1);

  const g = await credits(o.charge_id!);
  assert.deepEqual(g, [{ credits: 50, source: 'launch_offer' }], 'the 50 Papic credits did not land once');

  // A second call (the deposit acknowledgement after the yes) reuses — no
  // second charge, no second place, no second grant.
  const again = await openCharge(b.eventVendorId);
  assert.equal(again.charge_id, o.charge_id);
  assert.equal(again.reused, true);
  assert.equal((await credits(o.charge_id!)).length, 1, 'a re-call granted the credits twice');
  const used = await db.query<{ n: number }>(`SELECT count(*)::int AS n FROM public.booking_fee_ledger WHERE launch_offer`);
  assert.equal(used.rows[0]!.n, 1, 'a re-call counted the booking twice');
});

/* ── 3 ────────────────────────────────────────────────────────────────── */

test('3 · the cap-th booking is free and closes the offer; the next is normal; the shop keeps its five', async () => {
  await startOffer(3);
  const shop = await newVendor();
  const other = await newVendor();
  const a = await openCharge((await newBooking(shop)).eventVendorId);
  const b = await openCharge((await newBooking(shop)).eventVendorId);
  assert.equal((await settings()).closed, null, 'closed before the cap');
  const c = await openCharge((await newBooking(other)).eventVendorId);
  assert.deepEqual(
    [a.status, b.status, c.status],
    ['waived_launch', 'waived_launch', 'waived_launch'],
    'the cap-th booking must be free',
  );
  assert.equal(c.launch_offer_number, 3);

  const s = await settings();
  assert.ok(s.closed, 'the 3rd of 3 did not close the offer');
  assert.ok(s.pro, 'closing did not stamp free Pro’s end date');
  assert.ok(new Date(s.pro!).getTime() > new Date(s.closed!).getTime(), 'free Pro ends before the offer closed');

  // The next booking is decided as normal — and since launch bookings took no
  // place, this shop's NEXT sourced booking is the FIRST of its five.
  const d = await openCharge((await newBooking(shop)).eventVendorId);
  assert.equal(d.status, 'waived_free5', `after the offer, the shop's next booking was ${d.status}`);
  assert.equal(d.booking_ordinal, 1, 'the launch bookings used up the shop’s free five');
});

/* ── 4 ────────────────────────────────────────────────────────────────── */

test('4 · an import is never counted toward the offer', async () => {
  await startOffer(1);
  const vpid = await newVendor();
  const imp = await openCharge((await newBooking(vpid, { sourced: false })).eventVendorId);
  assert.equal(imp.status, 'waived_import');
  assert.equal((await settings()).closed, null, 'an import used up the only place');
  const real = await openCharge((await newBooking(vpid)).eventVendorId);
  assert.equal(real.status, 'waived_launch', 'the one place went to an import, not a Setnayan booking');
});

/* ── 5 ────────────────────────────────────────────────────────────────── */

test('5 · free Pro’s end: the SQL rule and its TypeScript twin agree on every case', async () => {
  assert.ok(LAUNCH_PRO_END_CASES.length >= 5, 'the case table shrank');
  for (const c of LAUNCH_PRO_END_CASES) {
    const r = await db.query<{ e: Date }>(
      `SELECT public.booking_fee_launch_offer_pro_end($1::timestamptz, $2::timestamptz, $3) AS e`,
      [c.startedAt, c.at, c.cycleDays],
    );
    const sql = new Date(r.rows[0]!.e).toISOString();
    assert.equal(sql, c.expect, `SQL disagrees with the table — ${c.name}`);
    assert.equal(launchProEndsAt(c.startedAt, c.at, c.cycleDays), sql, `the twin drifted — ${c.name}`);
  }
});

/* ── 6 ────────────────────────────────────────────────────────────────── */

test('6 · no gift is promised while the offer is open; the date is held; an amendment never re-bills', async () => {
  const vpid = await newVendor();
  const card = (
    await db.query<{ id: string }>(
      `INSERT INTO public.vendor_services (vendor_profile_id, category, starting_price_php, includes_setnayan_gift, is_active)
       VALUES ($1,'photographer',40000,TRUE,FALSE) RETURNING vendor_service_id AS id`,
      [vpid],
    )
  ).rows[0]!.id;
  // Past the shop's five, so the only thing that can waive is the offer.
  for (let i = 0; i < 5; i += 1) await openCharge((await newBooking(vpid)).eventVendorId);
  const q = await newBooking(vpid, { status: 'considering', serviceId: card });
  const ask = async () =>
    (await db.query<{ a: string }>(`SELECT public.setnayan_gift_quote_applies($1,$2) AS a`, [q.eventId, vpid])).rows[0]!.a;
  assert.equal(await ask(), 'applies', 'fixture: outside the offer the gift is real');
  await startOffer(2000);
  assert.equal(await ask(), 'fee_waived', 'the quote promised a gift on a launch-waived booking');

  const b = await newBooking(vpid, { serviceId: card });
  const o = await openCharge(b.eventVendorId);
  assert.equal(o.status, 'waived_launch');
  const gift = await db.query<{ credits: number }>(
    `SELECT gift_credits AS credits FROM public.booking_fee_charges WHERE charge_id = $1`,
    [o.charge_id],
  );
  assert.equal(Number(gift.rows[0]!.credits), 0, 'no fee, no gift — a launch charge sized a gift');

  await db.query(`SELECT public.vendor_hold_date_on_fee_settled($1)`, [o.charge_id]);
  const held = await db.query<{ n: number }>(
    `SELECT count(*)::int AS n FROM public.vendor_calendar_blocks WHERE vendor_profile_id = $1`,
    [vpid],
  );
  assert.ok(held.rows[0]!.n >= 1, 'a launch booking did not hold its date');

  const re = await db.query<{ r: { action: string } }>(
    `SELECT public.booking_fee_rederive_lock_fee($1) AS r`,
    [b.eventVendorId],
  );
  assert.equal(re.rows[0]!.r.action, 'launch_noop', 'an amendment re-priced a launch booking');
});

test('the status is settled, receipted and allowed everywhere it must be', async () => {
  assert.ok(FEE_SETTLED_STATUSES.has('waived_launch'), 'a launch booking would be LOCKED out of its event');
  assert.ok(WAIVED_FEE_RECEIPT_STATUSES.has('waived_launch'), 'a launch booking would send no receipt');
  const r = await db.query<{ def: string }>(
    `SELECT pg_get_constraintdef(oid) AS def FROM pg_constraint
      WHERE conrelid = 'public.booking_fee_charges'::regclass AND conname = 'booking_fee_charges_status_check'`,
  );
  for (const s of ['pending', 'paid', 'failed', 'expired', 'waived_import', 'waived_free5', 'waived_promo', 'cancelled_unbilled', 'waived_launch']) {
    assert.ok(r.rows[0]!.def.includes(`'${s}'`), `the status CHECK lost '${s}'`);
  }
  const g = await db.query<{ def: string }>(
    `SELECT pg_get_constraintdef(oid) AS def FROM pg_constraint
      WHERE conname = 'vendor_papic_portfolio_credit_grants_source_allowed'`,
  );
  for (const s of ['booking_fee', 'pack_order', 'admin', 'comp', 'migration', 'launch_offer']) {
    assert.ok(g.rows[0]!.def.includes(`'${s}'`), `the credit source CHECK lost '${s}'`);
  }
});
