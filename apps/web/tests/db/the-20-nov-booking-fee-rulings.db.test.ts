/**
 * THE 20 NOV BOOKING-FEE RULINGS, executed against the replayed migrations (20271354437946).
 *
 * Specs DECISION_LOG, 2026-11-20:
 *   💰 "BOOKING FEE: 5% OF THE FIRST ₱100,000, 3% AFTER, LOCKED AT ₱100,000" — and unverified shops pay the flat 5% of
 *      the whole booking, locked too.
 *   🎁 "EVERY 100,000TH BOOKING FEE IS FREE" + "…COUNTED ACROSS ALL OF SETNAYAN".
 *   🎟 "FREE BOOKING FEE TICKETS ARE AUTO-CLAIMED, NOT REDEEMED AT WILL".
 *   💳 "BILLING MUST FOLLOW THE RETIRED COPY" — no free first booking; a supplier-brought client is free only under the
 *      16 Nov import rule.
 *
 *   1 · THE NUMBERS LIVE IN SETTINGS, and SQL and TypeScript price every worked example the same, verified and not.
 *   2 · THE WORKED EXAMPLES through the real lock RPC: ₱50,000 · ₱100,000 · ₱250,000 · ₱10M (locked) · unverified.
 *   3 · SETNAYAN-BROUGHT vs SELF-BROUGHT: the same shop, the same ₱100,000 — billed vs no fee.
 *   4 · EVERY NTH IS FREE, counted across shops; a ticket the shop holds is not spent on it, and pays the next one.
 *   5 · THE COUNT IS EXACT: one row, consecutive numbers, unique, and a rolled-back booking gives its number back.
 *   6 · AN AMENDMENT keeps a platform-free booking free, and prices an unverified shop's top-up on the flat rate.
 *
 * WITHOUT THE MIGRATION every test here fails: the columns, the counter and the functions do not exist, the tail is 1%
 * and uncapped, and the first booking is waived.
 */
import { test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import type { PGlite } from '@electric-sql/pglite';
import { createReplayedDb, type ReplayResult } from './replay-migrations';
import {
  BOOKING_FEE,
  bookingFeePhp,
  bookingFeeScheduleSummary,
  unverifiedBookingFeePhp,
} from '../../lib/booking-fee';
import { BOOKING_FEE_SCHEDULE_VERSION } from '../../lib/booking-fee-gate';
import { FREE_BOOKING_LIMIT, decideLockFee, isPlatformFreeNumber } from '../../lib/booking-fee-lock';

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
  // No launch offer, no promotion: only the 20 Nov rules decide.
  await db.query(
    `UPDATE public.platform_settings
        SET launch_offer_enabled = NULL, launch_offer_started_at = NULL,
            launch_offer_closed_at = NULL, launch_offer_pro_ends_at = NULL,
            booking_fee_free_from = NULL, booking_fee_free_until = NULL,
            booking_fee_free_every_nth = 100000
      WHERE id = 1`,
  );
});

let seq = 0;
const uniq = () => `nov20-${++seq}-${Date.now()}`;

async function newShop(verified = true): Promise<string> {
  const u = await db.query<{ id: string }>(
    `INSERT INTO auth.users (email, raw_user_meta_data)
     VALUES ($1, jsonb_build_object('account_type','customer')) RETURNING id`,
    [`${uniq()}@t.local`],
  );
  const v = await db.query<{ vendor_profile_id: string }>(
    verified
      ? `INSERT INTO public.vendor_profiles
           (user_id, business_name, location_city, services, verification_state, last_verified_at, public_visibility)
         VALUES ($1,'Nov Studio','Manila',ARRAY['photography']::text[],'verified',TIMESTAMPTZ '2020-01-01','verified')
         RETURNING vendor_profile_id`
      : `INSERT INTO public.vendor_profiles
           (user_id, business_name, location_city, services, verification_state)
         VALUES ($1,'Nov Studio','Manila',ARRAY['photography']::text[],'unverified')
         RETURNING vendor_profile_id`,
    [u.rows[0]!.id],
  );
  return v.rows[0]!.vendor_profile_id;
}

/** A booking Setnayan brought: a chat that started in Explore. */
async function sourcedBooking(shop: string, totalPhp: number) {
  const e = await db.query<{ event_id: string }>(
    `INSERT INTO public.events (display_name, event_type, event_date)
     VALUES ('A birthday','birthday','2031-02-14') RETURNING event_id`,
  );
  const eventId = e.rows[0]!.event_id;
  await db.query(
    `INSERT INTO public.chat_threads (event_id, vendor_profile_id, inquiry_source) VALUES ($1, $2, 'explore')`,
    [eventId, shop],
  );
  const ev = await db.query<{ vendor_id: string }>(
    `INSERT INTO public.event_vendors
       (event_id, category, vendor_name, status, marketplace_vendor_id, total_cost_php)
     VALUES ($1,'photographer','Nov Studio','contracted'::vendor_status,$2,$3) RETURNING vendor_id`,
    [eventId, shop, totalPhp],
  );
  return { eventId, eventVendorId: ev.rows[0]!.vendor_id };
}

/** A booking the supplier brought: the event's first import (its own Locked QR), nothing from Setnayan. */
async function selfBroughtBooking(shop: string, totalPhp: number) {
  const e = await db.query<{ event_id: string }>(
    `INSERT INTO public.events (display_name, event_type, event_date)
     VALUES ('Their own client','birthday','2031-03-14') RETURNING event_id`,
  );
  const eventId = e.rows[0]!.event_id;
  const ev = await db.query<{ vendor_id: string }>(
    `INSERT INTO public.event_vendors
       (event_id, category, vendor_name, status, marketplace_vendor_id, total_cost_php, source)
     VALUES ($1,'photographer','Nov Studio','contracted'::vendor_status,$2,$3,'vendor_locked_qr') RETURNING vendor_id`,
    [eventId, shop, totalPhp],
  );
  return { eventId, eventVendorId: ev.rows[0]!.vendor_id };
}

type Open = {
  charge_id?: string;
  status?: string;
  amount_charged_centavos?: number;
  computed_fee_centavos?: number;
  platform_fee_number?: number | null;
  free_by_platform_count?: boolean;
  badge_reward_id?: string | null;
  attribution?: string;
};
async function lock(evId: string): Promise<Open> {
  const r = await db.query<{ r: Open }>(`SELECT public.booking_fee_open_lock_charge($1, $2) AS r`, [
    evId,
    BOOKING_FEE_SCHEDULE_VERSION,
  ]);
  return r.rows[0]!.r;
}
async function one<T>(sql: string, params: unknown[] = []): Promise<T> {
  return (await db.query<T>(sql, params)).rows[0]!;
}
async function setCounter(n: number) {
  await db.query(`UPDATE public.booking_fee_platform_counter SET fee_bookings_counted = $1 WHERE id = 1`, [n]);
}

test('1 · the numbers live in settings, and SQL and TypeScript price the same', async () => {
  const s = await one<{ head: string; tail: string; band: string; cap: string; nth: number }>(
    `SELECT booking_fee_rate_pct AS head, booking_fee_tail_rate_pct AS tail, booking_fee_tier1_limit_php AS band,
            booking_fee_cap_php AS cap, booking_fee_free_every_nth AS nth
       FROM public.platform_settings WHERE id = 1`,
  );
  assert.deepEqual([Number(s.head), Number(s.tail), Number(s.band), Number(s.cap), Number(s.nth)], [5, 3, 100000, 100000, 100000]);
  // The TypeScript fallback is the ruled schedule, so an unreadable settings row still prices honestly.
  assert.deepEqual(
    [BOOKING_FEE.rate, BOOKING_FEE.tailRate, BOOKING_FEE.tier1LimitPhp, BOOKING_FEE.capPhp],
    [0.05, 0.03, 100_000, 100_000],
  );
  assert.equal(FREE_BOOKING_LIMIT, 0);

  for (const php of [500, 50_000, 100_000, 100_001, 250_000, 1_000_000, 3_266_667, 5_000_000, 10_000_000]) {
    const r = await one<{ v: string; f: string }>(
      `SELECT public.booking_fee_centavos($1) AS v, public.booking_fee_flat_centavos($1) AS f`,
      [php * 100],
    );
    assert.equal(Number(r.v), Math.round(bookingFeePhp(php) * 100), `verified ₱${php}: SQL ${r.v} vs TS`);
    assert.equal(Number(r.f), Math.round(unverifiedBookingFeePhp(php) * 100), `unverified ₱${php}: SQL ${r.f} vs TS`);
  }
  const summary = await one<{ s: string }>(`SELECT public.booking_fee_schedule_summary() AS s`);
  assert.equal(summary.s, bookingFeeScheduleSummary(BOOKING_FEE), 'the bill sentence differs between SQL and TS');
  assert.equal(summary.s, '5% of the first ₱100,000, then 3%, minimum ₱50, never more than ₱100,000');
  const ver = await one<{ v: string }>(`SELECT public.booking_fee_schedule_version() AS v`);
  assert.equal(ver.v, BOOKING_FEE_SCHEDULE_VERSION);

  // A reprice moves both halves — the lock is a setting, not a literal.
  await db.query(`UPDATE public.platform_settings SET booking_fee_cap_php = 20000 WHERE id = 1`);
  try {
    const r = await one<{ v: string }>(`SELECT public.booking_fee_centavos($1) AS v`, [1_000_000 * 100]);
    assert.equal(Number(r.v), 2_000_000, 'the lock did not follow the setting');
    assert.equal(bookingFeePhp(1_000_000, { ...BOOKING_FEE, capPhp: 20_000 }), 20_000);
  } finally {
    await db.query(`UPDATE public.platform_settings SET booking_fee_cap_php = 100000 WHERE id = 1`);
  }
});

test('2 · worked examples through the lock RPC — the first booking is billed', async () => {
  const cases: Array<[number, number]> = [
    [50_000, 2_500],       // 5% of ₱50,000
    [100_000, 5_000],      // 5% of ₱100,000
    [250_000, 9_500],      // ₱5,000 + 3% of ₱150,000
    [10_000_000, 100_000], // ₱5,000 + 3% of ₱9.9M = ₱302,000 → locked at ₱100,000
  ];
  for (const [total, fee] of cases) {
    const shop = await newShop(true);
    const r = await lock((await sourcedBooking(shop, total)).eventVendorId);
    assert.equal(r.status, 'pending', `₱${total}: a first Setnayan booking was ${r.status}, not billed`);
    assert.equal(r.amount_charged_centavos, fee * 100, `₱${total}: billed ${r.amount_charged_centavos}`);
    assert.ok(Number(r.platform_fee_number) > 0, `₱${total}: the booking took no place in Setnayan's count`);
  }
  // Unverified: the flat 5% of the whole booking, locked too.
  const flat = await newShop(false);
  const u = await lock((await sourcedBooking(flat, 250_000)).eventVendorId);
  assert.equal(u.status, 'pending');
  assert.equal(u.amount_charged_centavos, 12_500 * 100, 'an unverified shop was not billed the flat 5% of ₱250,000');
  const flatBig = await newShop(false);
  const ub = await lock((await sourcedBooking(flatBig, 10_000_000)).eventVendorId);
  assert.equal(ub.amount_charged_centavos, 100_000 * 100, 'the unverified flat rate is not locked at ₱100,000');
});

test('3 · Setnayan-brought pays, self-brought (the event\'s first import) does not', async () => {
  const shop = await newShop(true);
  const setnayan = await lock((await sourcedBooking(shop, 100_000)).eventVendorId);
  assert.equal(setnayan.status, 'pending');
  assert.equal(setnayan.amount_charged_centavos, 500_000);

  const own = await lock((await selfBroughtBooking(shop, 100_000)).eventVendorId);
  assert.equal(own.attribution, 'import', `a self-brought first import was attributed ${own.attribution}`);
  assert.equal(own.status, 'waived_import');
  assert.equal(own.amount_charged_centavos, 0);
  const n = await one<{ n: string | null }>(`SELECT platform_fee_number AS n FROM public.booking_fee_charges WHERE charge_id = $1`, [
    own.charge_id,
  ]);
  assert.equal(n.n, null, 'a booking with no fee took a place in the count of fee bookings');
});

test('4 · every Nth fee booking on Setnayan is free, across shops — a ticket is not spent on it', async () => {
  await db.query(`UPDATE public.platform_settings SET booking_fee_free_every_nth = 5 WHERE id = 1`);
  await setCounter(13); // the next three fee bookings are 14, 15 (free), 16

  const a = await newShop(true);
  const b = await newShop(true);
  // Shop B holds a free booking fee ticket.
  await db.query(`SELECT public.shop_badge_reward_grant($1, 'events:1000', 'events', 'fee_waiver', 1, NULL, 'test')`, [b]);

  const first = await lock((await sourcedBooking(a, 100_000)).eventVendorId);
  assert.equal(first.platform_fee_number, 14);
  assert.equal(first.status, 'pending');

  // Number 15 lands on the OTHER shop — the count is Setnayan's, not a shop's.
  const nth = await lock((await sourcedBooking(b, 100_000)).eventVendorId);
  assert.equal(nth.platform_fee_number, 15);
  assert.equal(nth.free_by_platform_count, true, 'booking fee 15 of every 5th was billed');
  assert.equal(nth.status, 'paid');
  assert.equal(nth.amount_charged_centavos, 0);
  assert.equal(nth.computed_fee_centavos, 500_000, 'the free one does not record what it would have cost');
  assert.equal(nth.badge_reward_id, null, 'Setnayan’s free booking fee spent the shop’s ticket');

  // The ticket is auto-claimed by shop B's NEXT fee booking — no choice, no redeem.
  const next = await lock((await sourcedBooking(b, 100_000)).eventVendorId);
  assert.equal(next.platform_fee_number, 16);
  assert.equal(next.free_by_platform_count, false);
  assert.ok(next.badge_reward_id, 'the ticket was not used on the next booking with a fee');
  assert.equal(next.amount_charged_centavos, 0);

  // A re-lock hands back the same charge and takes no new number.
  const again = await lock((await one<{ id: string }>(
    `SELECT event_vendor_id AS id FROM public.booking_fee_charges WHERE charge_id = $1`, [nth.charge_id])).id);
  assert.equal(again.charge_id, nth.charge_id);
  assert.equal(Number((await one<{ n: string }>(`SELECT fee_bookings_counted AS n FROM public.booking_fee_platform_counter`)).n), 16);

  // The pure twin agrees on the boundary.
  assert.equal(isPlatformFreeNumber(15, 5), true);
  assert.equal(isPlatformFreeNumber(16, 5), false);
  assert.equal(isPlatformFreeNumber(100_000, 100_000), true);
  const d = decideLockFee({
    flagEnabled: true, onPlatform: true, attribution: 'sourced', shopVerified: true, frozenFree: false,
    launchOffer: false, promoWindow: false, schedule: BOOKING_FEE, nextPlatformNumber: 15, freeEveryNth: 5,
    ticketWaiting: true, agreedTotalPhp: 100_000,
  });
  assert.deepEqual([d.reason, d.feePhp, d.computedFeePhp], ['every_nth', 0, 5_000]);
});

test('5 · the count is exact: one row, unique numbers, and a rolled-back booking gives its number back', async () => {
  const rows = await one<{ n: string }>(`SELECT count(*) AS n FROM public.booking_fee_platform_counter`);
  assert.equal(Number(rows.n), 1);
  await assert.rejects(db.query(`INSERT INTO public.booking_fee_platform_counter (id) VALUES (2)`), /check/i);

  await setCounter(40);
  await db.query('BEGIN');
  const taken = await one<{ n: string }>(`SELECT public.booking_fee_take_platform_number() AS n`);
  await db.query('ROLLBACK');
  assert.equal(Number(taken.n), 41);
  const retaken = await one<{ n: string }>(`SELECT public.booking_fee_take_platform_number() AS n`);
  assert.equal(Number(retaken.n), 41, 'a rolled-back booking kept its number — the count would skip');
  const after = await one<{ n: string }>(`SELECT public.booking_fee_take_platform_number() AS n`);
  assert.equal(Number(after.n), 42);

  const idx = await one<{ def: string }>(
    `SELECT indexdef AS def FROM pg_indexes WHERE indexname = 'booking_fee_charges_platform_fee_number_once'`,
  );
  assert.match(idx.def, /UNIQUE/i, 'two charges could hold the same number');

  // RLS at CREATE: on, and no session role may read or move the count.
  const rls = await one<{ on: boolean }>(
    `SELECT relrowsecurity AS on FROM pg_class WHERE oid = 'public.booking_fee_platform_counter'::regclass`,
  );
  assert.equal(rls.on, true);
  for (const role of ['anon', 'authenticated']) {
    const p = await one<{ t: boolean; f: boolean }>(
      `SELECT has_table_privilege($1, 'public.booking_fee_platform_counter', 'SELECT') AS t,
              has_function_privilege($1, 'public.booking_fee_take_platform_number()', 'EXECUTE') AS f`,
      [role],
    );
    assert.deepEqual([p.t, p.f], [false, false], `${role} can reach the count`);
  }
});

test('6 · an amendment keeps Setnayan’s free booking free, and prices an unverified top-up flat', async () => {
  await db.query(`UPDATE public.platform_settings SET booking_fee_free_every_nth = 3 WHERE id = 1`);
  await setCounter(1001); // the next fee booking is 1002, a multiple of 3
  const shop = await newShop(true);
  const b = await sourcedBooking(shop, 100_000);
  const free = await lock(b.eventVendorId);
  assert.equal(free.free_by_platform_count, true);
  await db.query(`UPDATE public.event_vendors SET total_cost_php = 400000 WHERE vendor_id = $1`, [b.eventVendorId]);
  const rd = await one<{ r: { action: string } }>(`SELECT public.booking_fee_rederive_lock_fee($1) AS r`, [b.eventVendorId]);
  assert.equal(rd.r.action, 'platform_free_noop', `an amended free booking was re-billed: ${rd.r.action}`);

  const flat = await newShop(false);
  const u = await sourcedBooking(flat, 100_000);
  const billed = await lock(u.eventVendorId);
  assert.equal(billed.status, 'pending');
  // The total's own trigger re-derives the fee; asking again is a no-op on the same figure.
  await db.query(`UPDATE public.event_vendors SET total_cost_php = 300000 WHERE vendor_id = $1`, [u.eventVendorId]);
  await db.query(`SELECT public.booking_fee_rederive_lock_fee($1)`, [u.eventVendorId]);
  const up = await one<{ a: string }>(
    `SELECT amount_charged_centavos AS a FROM public.booking_fee_charges WHERE charge_id = $1`,
    [billed.charge_id],
  );
  assert.equal(Number(up.a), 15_000 * 100, 'an unverified shop’s amended fee used the taper, not the flat 5%');
});
