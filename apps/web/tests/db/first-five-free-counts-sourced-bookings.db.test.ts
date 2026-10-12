/**
 * A SHOP'S FIRST FIVE FREE BOOKINGS ARE ITS FIRST FIVE SETNAYAN-SOURCED ONES.
 *
 * ⚖ Owner 2026-10-12 ("APPROVE ALL: THE BOOKING-FEE QUESTIONS (14)", answer 2):
 * first-5-free counts only Setnayan-sourced bookings. Migration 20271268252763.
 *
 * Before it, an import (a client the shop brought itself) took a place among
 * the five, so a shop that imported its own clients first was billed on its
 * first real Setnayan booking. Executed against replayed migrations.
 *
 * SABOTAGE (2026-10-12): drop `l2.attribution = 'sourced'` from the lock RPC's
 * count → test 1 RED (the 3rd sourced booking is billed); drop it from the
 * quote's count → test 2 RED.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { PGlite } from '@electric-sql/pglite';
import { createReplayedDb, type ReplayResult } from './replay-migrations';
import { stripComments } from '../../lib/strip-comments';

let replay: ReplayResult;
let db: PGlite;
before(async () => {
  replay = await createReplayedDb();
  db = replay.db;
});
after(async () => {
  await db?.close();
});

let seq = 0;
const uniq = () => `f5s-${++seq}-${Date.now()}`;

async function newVendor(): Promise<string> {
  const u = await db.query<{ id: string }>(
    `INSERT INTO auth.users (email, raw_user_meta_data)
     VALUES ($1, jsonb_build_object('account_type','customer')) RETURNING id`,
    [`${uniq()}@t.local`],
  );
  const v = await db.query<{ vendor_profile_id: string }>(
    `INSERT INTO public.vendor_profiles
       (user_id, business_name, location_city, services, verification_state, last_verified_at)
     VALUES ($1,'Five Studio','Manila',ARRAY['photography']::text[],'verified',NOW())
     RETURNING vendor_profile_id`,
    [u.rows[0]!.id],
  );
  return v.rows[0]!.vendor_profile_id;
}

async function newBooking(vpid: string, sourced: boolean, status = 'contracted') {
  const e = await db.query<{ event_id: string }>(
    `INSERT INTO public.events (display_name, event_type, event_date)
     VALUES ('A celebration','birthday','2030-06-01') RETURNING event_id`,
  );
  const eventId = e.rows[0]!.event_id;
  const ev = await db.query<{ vendor_id: string }>(
    `INSERT INTO public.event_vendors
       (event_id, category, vendor_name, status, marketplace_vendor_id, total_cost_php)
     VALUES ($1,'photographer','Five Studio',$2::vendor_status,$3,50000) RETURNING vendor_id`,
    [eventId, status, vpid],
  );
  if (sourced) {
    await db.query(
      `INSERT INTO public.chat_threads (event_id, vendor_profile_id, inquiry_source)
       VALUES ($1, $2, 'explore')`,
      [eventId, vpid],
    );
  }
  return { eventId, eventVendorId: ev.rows[0]!.vendor_id };
}

type Open = { status?: string; booking_ordinal?: number; skipped?: string };
async function openCharge(evId: string): Promise<Open> {
  const r = await db.query<{ r: Open }>(`SELECT public.booking_fee_open_lock_charge($1) AS r`, [evId]);
  return r.rows[0]!.r;
}

test('imports first, then five Setnayan bookings — all five are free, the sixth is billed', async () => {
  const vpid = await newVendor();
  for (let i = 0; i < 3; i += 1) {
    const imp = await newBooking(vpid, false);
    assert.equal((await openCharge(imp.eventVendorId)).status, 'waived_import', 'fixture: an import');
  }
  for (let i = 1; i <= 5; i += 1) {
    const b = await newBooking(vpid, true);
    const r = await openCharge(b.eventVendorId);
    assert.equal(
      r.status,
      'waived_free5',
      `Setnayan booking ${i} was billed after 3 imports — the imports used up the shop's free five`,
    );
    assert.equal(r.booking_ordinal, i, `booking ${i} took ordinal ${r.booking_ordinal}`);
  }
  const sixth = await newBooking(vpid, true);
  assert.equal((await openCharge(sixth.eventVendorId)).status, 'pending', 'the sixth sourced booking is billed');
});

test("the quote's projection counts the same way", async () => {
  const vpid = await newVendor();
  for (let i = 0; i < 6; i += 1) {
    const imp = await newBooking(vpid, false);
    await openCharge(imp.eventVendorId);
  }
  // A sourced booking still being asked for (no ledger row yet).
  const q = await newBooking(vpid, true, 'considering');
  const r = await db.query<{ a: string }>(`SELECT public.setnayan_gift_quote_applies($1, $2) AS a`, [
    q.eventId,
    vpid,
  ]);
  assert.equal(r.rows[0]!.a, 'free_booking', 'six imports made the first Setnayan booking look billable');
});

test('a FROZEN ordinal is never re-derived', async () => {
  const vpid = await newVendor();
  const b = await newBooking(vpid, true);
  await db.query(
    `INSERT INTO public.booking_fee_ledger
       (vendor_profile_id, event_id, source, attribution, attribution_frozen_at, booking_ordinal, is_free_booking)
     VALUES ($1, $2, 'lock', 'sourced', NOW(), 9, FALSE)`,
    [vpid, b.eventId],
  );
  const r = await openCharge(b.eventVendorId);
  assert.equal(r.booking_ordinal, 9, 'a booking already given a place lost it');
  assert.equal(r.status, 'pending');
});

test('the TS projection carries the same predicate', () => {
  const HERE = dirname(fileURLToPath(import.meta.url));
  const src = stripComments(readFileSync(join(HERE, '../../lib/booking-fee-disclosure.server.ts'), 'utf8'));
  const at = src.indexOf(".from('booking_fee_ledger')\n      .select('ledger_id', { count: 'exact', head: true })");
  assert.ok(at > 0, 'the projection count moved — re-point this guard');
  assert.match(src.slice(at, at + 300), /\.eq\('attribution', 'sourced'\)/, 'the screen counts imports the bill does not');
});
