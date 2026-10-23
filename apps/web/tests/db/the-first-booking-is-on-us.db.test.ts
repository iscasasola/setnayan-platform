/**
 * THE FIRST BOOKING IS ON US — ONE, NOT FIVE. Executed against replayed migrations.
 *
 * ⚖ OWNER, 2026-10-23, verbatim: *"Your first booking is on us. Not 5. Then the
 * first 2000 bookings is also free."* Migration 20271284624593.
 *
 *   1 · ONE HOME FOR THE NUMBER. `booking_fee_free_booking_limit()` is the value
 *       the RPC reads; `FREE_BOOKING_LIMIT` is its TypeScript twin for the copy.
 *       They must agree, and both bodies must CALL the function — a literal
 *       left in either is a second source of truth.
 *   2 · THE MONEY. With no launch offer, a shop's first Setnayan booking is
 *       `waived_free5` and its second is `pending` with a real fee. The quote's
 *       projection says the same before the second booking exists.
 *   3 · NOTHING ALREADY GIVEN IS TAKEN BACK. Bookings frozen free under the old
 *       five-booking rule (ordinals 1…3, `is_free_booking`) stay waived when the
 *       RPC is re-asked; only a booking that takes its place now is billed.
 *   4 · THE LAUNCH OFFER STILL WAIVES INSIDE ITS CAP, takes no free place, and
 *       the shop still has its one free booking after it.
 *
 * SABOTAGE (2026-10-23): `SELECT 5` in `booking_fee_free_booking_limit()` →
 * tests 1 + 2 RED; restore the literal `v_ordinal <= 5` in the lock RPC → test 1
 * RED (the body no longer calls the function) and test 2 RED; re-derive a frozen
 * row (`v_is_free := v_ordinal <= …` in the ELSE arm) → test 3 RED.
 */
import { test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import type { PGlite } from '@electric-sql/pglite';
import { createReplayedDb, type ReplayResult } from './replay-migrations';
import { FREE_BOOKING_LIMIT } from '../../lib/booking-fee-lock';

let replay: ReplayResult;
let db: PGlite;
before(async () => {
  replay = await createReplayedDb();
  db = replay.db;
});
after(async () => {
  await db?.close();
});
beforeEach(async () => {
  // No launch offer, no promotion — the shop's own free booking is the only waiver.
  await db.query(
    `UPDATE public.platform_settings
        SET launch_offer_enabled = NULL, launch_offer_started_at = NULL,
            launch_offer_closed_at = NULL, launch_offer_pro_ends_at = NULL,
            launch_offer_booking_cap = 2000,
            booking_fee_free_from = NULL, booking_fee_free_until = NULL
      WHERE id = 1`,
  );
});

let seq = 0;
const uniq = () => `first1-${++seq}-${Date.now()}`;

async function newVendor(): Promise<string> {
  const u = await db.query<{ id: string }>(
    `INSERT INTO auth.users (email, raw_user_meta_data)
     VALUES ($1, jsonb_build_object('account_type','customer')) RETURNING id`,
    [`${uniq()}@t.local`],
  );
  const v = await db.query<{ vendor_profile_id: string }>(
    `INSERT INTO public.vendor_profiles
       (user_id, business_name, location_city, services, verification_state, last_verified_at)
     VALUES ($1,'First Studio','Manila',ARRAY['photography']::text[],'verified',NOW())
     RETURNING vendor_profile_id`,
    [u.rows[0]!.id],
  );
  return v.rows[0]!.vendor_profile_id;
}

async function newBooking(vpid: string, status = 'contracted') {
  const e = await db.query<{ event_id: string }>(
    `INSERT INTO public.events (display_name, event_type, event_date)
     VALUES ('An event','birthday','2030-08-01') RETURNING event_id`,
  );
  const eventId = e.rows[0]!.event_id;
  const ev = await db.query<{ vendor_id: string }>(
    `INSERT INTO public.event_vendors
       (event_id, category, vendor_name, status, marketplace_vendor_id, total_cost_php)
     VALUES ($1,'photographer','First Studio',$2::vendor_status,$3,50000) RETURNING vendor_id`,
    [eventId, status, vpid],
  );
  await db.query(
    `INSERT INTO public.chat_threads (event_id, vendor_profile_id, inquiry_source)
     VALUES ($1, $2, 'explore')`,
    [eventId, vpid],
  );
  return { eventId, eventVendorId: ev.rows[0]!.vendor_id };
}

type Open = {
  charge_id?: string;
  status?: string;
  booking_ordinal?: number | null;
  is_free?: boolean;
  amount_charged_centavos?: number;
  computed_fee_centavos?: number;
  reused?: boolean;
};
async function openCharge(evId: string): Promise<Open> {
  const r = await db.query<{ r: Open }>(`SELECT public.booking_fee_open_lock_charge($1) AS r`, [evId]);
  return r.rows[0]!.r;
}

test('1 · the SQL limit is the TS twin, and both bodies read it (no literal left behind)', async () => {
  const r = await db.query<{ n: number }>(`SELECT public.booking_fee_free_booking_limit() AS n`);
  assert.equal(r.rows[0]!.n, 1, 'the database no longer gives one free booking');
  assert.equal(r.rows[0]!.n, FREE_BOOKING_LIMIT, 'the SQL limit and FREE_BOOKING_LIMIT disagree — two sources of truth');

  for (const fn of ['booking_fee_open_lock_charge', 'setnayan_gift_quote_applies']) {
    const d = await db.query<{ def: string }>(
      `SELECT pg_get_functiondef(p.oid) AS def FROM pg_proc p
         JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname = 'public' AND p.proname = $1`,
      [fn],
    );
    assert.equal(d.rows.length, 1, `${fn} has ${d.rows.length} overloads`);
    const def = d.rows[0]!.def;
    assert.match(def, /booking_fee_free_booking_limit\(\)/, `${fn} does not read the one limit`);
    assert.doesNotMatch(def, /ordinal(?:,\s*1\))?\s*<=\s*\d/, `${fn} still compares the ordinal to a literal`);
  }
});

test('2 · no launch offer: booking #1 is waived, booking #2 is billed — and the quote says so first', async () => {
  const vpid = await newVendor();
  const first = await openCharge((await newBooking(vpid)).eventVendorId);
  assert.equal(first.status, 'waived_free5', `the first booking was ${first.status}`);
  assert.equal(first.booking_ordinal, 1);
  assert.equal(first.amount_charged_centavos, 0, 'the free booking charged money');
  assert.ok((first.computed_fee_centavos ?? 0) > 0, 'the free booking does not record what it would have cost');

  // Before the second booking exists, the quote's projection already counts it billable.
  const ask = await newBooking(vpid, 'considering');
  const q = await db.query<{ a: string }>(`SELECT public.setnayan_gift_quote_applies($1, $2) AS a`, [ask.eventId, vpid]);
  assert.notEqual(q.rows[0]!.a, 'free_booking', 'the quote promised the second booking free');

  const second = await openCharge((await newBooking(vpid)).eventVendorId);
  assert.equal(second.status, 'pending', `booking #2 was ${second.status} — the five-booking rule is back`);
  assert.equal(second.booking_ordinal, 2);
  assert.ok((second.amount_charged_centavos ?? 0) > 0, 'booking #2 carried no fee');
});

test('3 · bookings frozen free under the old rule stay waived; the next one is billed', async () => {
  const vpid = await newVendor();
  // Three bookings that took their place under the five-booking rule: ordinals
  // 1…3, each frozen free — as production holds them.
  const old: { eventVendorId: string }[] = [];
  for (let i = 1; i <= 3; i += 1) {
    const b = await newBooking(vpid);
    await db.query(
      `INSERT INTO public.booking_fee_ledger
         (vendor_profile_id, event_id, source, attribution, attribution_frozen_at,
          booking_ordinal, is_free_booking, created_at)
       VALUES ($1, $2, 'lock', 'sourced', NOW(), $3, TRUE, NOW() - make_interval(days => 10 - $3))`,
      [vpid, b.eventId, i],
    );
    old.push(b);
  }
  // Re-asked now (a deposit acknowledgement, a re-lock), booking 3 keeps its waiver.
  const third = await openCharge(old[2]!.eventVendorId);
  assert.equal(third.booking_ordinal, 3, 'a frozen place moved');
  assert.equal(third.status, 'waived_free5', `a booking waived under the old rule was re-billed: ${third.status}`);
  assert.equal(third.amount_charged_centavos, 0, 'a charge-back on a booking that was already free');

  // A booking that takes its place NOW is counted against the new limit.
  const fourth = await openCharge((await newBooking(vpid)).eventVendorId);
  assert.equal(fourth.booking_ordinal, 4);
  assert.equal(fourth.status, 'pending', 'the change did not reach a booking made after it shipped');
});

test('4 · the launch offer still waives within its cap, and the shop keeps its one free booking', async () => {
  await db.query(
    `UPDATE public.platform_settings
        SET launch_offer_enabled = TRUE, launch_offer_started_at = NOW() - INTERVAL '1 day',
            launch_offer_booking_cap = 2
      WHERE id = 1`,
  );
  const vpid = await newVendor();
  const a = await openCharge((await newBooking(vpid)).eventVendorId);
  const b = await openCharge((await newBooking(vpid)).eventVendorId);
  assert.deepEqual([a.status, b.status], ['waived_launch', 'waived_launch'], 'the launch offer stopped waiving inside its cap');
  assert.deepEqual([a.booking_ordinal, b.booking_ordinal], [null, null], 'a launch booking used up the free one');

  // Offer closed at its cap: the shop's next booking is ITS free one, then billing starts.
  const c = await openCharge((await newBooking(vpid)).eventVendorId);
  assert.equal(c.status, 'waived_free5', `after the offer the shop's free booking was gone: ${c.status}`);
  assert.equal(c.booking_ordinal, 1);
  const d = await openCharge((await newBooking(vpid)).eventVendorId);
  assert.equal(d.status, 'pending', 'after the offer and the free booking, nothing was billed');
});
