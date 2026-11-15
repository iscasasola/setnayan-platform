/**
 * HOLE 3 · THE BOOKING FEE FOLLOWS THE EVENT, NOT THE COUPLE — PROVEN OPEN (controller sweep 2026-11-16).
 *
 * TESTS ONLY. The assertion below PASSES WHILE THE HOLE IS OPEN. The fix PR
 * flips it to its closed form and renames the file.
 *
 * Owner / LOCKED §3: a couple Setnayan sourced to a shop is sourced for the
 * first booking AND EVERY REPEAT. But `booking_fee_attribution_for(vendor, event)`
 * only reads facts keyed on THAT event (chat_threads.event_id,
 * event_vendors.event_id, vendor_profile_views.event_id), and
 * `booking_fee_ledger` is UNIQUE (vendor_profile_id, event_id). So the same
 * couple, on their next celebration, books the same shop directly and it is an
 * 'import' — free forever.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import type { PGlite } from '@electric-sql/pglite';
import { createReplayedDb, setAuthUid } from './replay-migrations';

let db: PGlite;
let n = 0;

before(async () => {
  db = (await createReplayedDb()).db;
  await db.exec('RESET ROLE').catch(() => {});
  await setAuthUid(db, null).catch(() => {});
});
after(async () => {
  await db?.close();
});

async function newUser(tag: string): Promise<string> {
  const r = await db.query<{ id: string }>(
    `INSERT INTO auth.users (email, raw_user_meta_data) VALUES ($1, jsonb_build_object('account_type','customer')) RETURNING id`,
    [`${tag}-${++n}@hole-3.test`],
  );
  return r.rows[0]!.id;
}

async function newShop(): Promise<string> {
  const owner = await newUser('shop');
  const r = await db.query<{ vendor_profile_id: string }>(
    `INSERT INTO public.vendor_profiles
       (user_id, business_name, location_city, services, verification_state, last_verified_at, public_visibility)
     VALUES ($1, $2, 'Manila', ARRAY['catering']::text[], 'verified', NOW(), 'verified')
     RETURNING vendor_profile_id`,
    [owner, `Kusina ${n}`],
  );
  return r.rows[0]!.vendor_profile_id;
}

async function newEventFor(couple: string): Promise<string> {
  const r = await db.query<{ event_id: string }>(
    `INSERT INTO public.events (display_name, event_type) VALUES ($1, 'birthday') RETURNING event_id`,
    [`Hole 3 ${++n}`],
  );
  const eventId = r.rows[0]!.event_id;
  await db.query(`INSERT INTO public.event_members (event_id, user_id, member_type) VALUES ($1, $2, 'couple')`, [
    eventId,
    couple,
  ]);
  return eventId;
}

async function attribution(shop: string, eventId: string): Promise<string> {
  const r = await db.query<{ a: string }>(`SELECT public.booking_fee_attribution_for($1, $2) AS a`, [shop, eventId]);
  return r.rows[0]!.a;
}

test('HOLE OPEN · 3 — the same couple, sourced to a shop on event A, books it again on event B and B is an import', async () => {
  const shop = await newShop();
  const couple = await newUser('couple');

  // Event A — Setnayan introduced them: a chat started from Find, a booking, a frozen sourced ledger row.
  const eventA = await newEventFor(couple);
  const t = await db.query<{ thread_id: string }>(
    `INSERT INTO public.chat_threads (event_id, vendor_profile_id, inquiry_source) VALUES ($1, $2, 'search') RETURNING thread_id`,
    [eventA, shop],
  );
  await db.query(
    `INSERT INTO public.event_vendors (event_id, marketplace_vendor_id, category, vendor_name, status, source)
     VALUES ($1, $2, 'catering', 'Kusina', 'considering', 'host_marketplace_search')`,
    [eventA, shop],
  );
  await db.query(
    `INSERT INTO public.booking_fee_ledger (vendor_profile_id, event_id, attribution, attribution_thread_id, attribution_frozen_at)
     VALUES ($1, $2, 'sourced', $3, NOW())`,
    [shop, eventA, t.rows[0]!.thread_id],
  );
  assert.equal(await attribution(shop, eventA), 'sourced', 'precondition: event A is Setnayan-sourced');

  // Event B — same couple, same shop, contacted directly (a chat with no Setnayan surface, the couple's own add).
  const eventB = await newEventFor(couple);
  await db.query(`INSERT INTO public.chat_threads (event_id, vendor_profile_id, inquiry_source) VALUES ($1, $2, NULL)`, [
    eventB,
    shop,
  ]);
  await db.query(
    `INSERT INTO public.event_vendors (event_id, marketplace_vendor_id, category, vendor_name, status, source)
     VALUES ($1, $2, 'catering', 'Kusina', 'considering', 'host_manual')`,
    [eventB, shop],
  );

  // HOLE OPEN: the repeat booking is free. Fix flips to: 'sourced' (LOCKED §3, every repeat).
  assert.equal(await attribution(shop, eventB), 'import', 'booking_fee_attribution_for forgets the couple across events');
});
