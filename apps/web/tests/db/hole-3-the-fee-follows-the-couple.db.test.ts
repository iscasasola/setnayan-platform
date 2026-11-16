/**
 * HOLE 3 · THE BOOKING FEE FOLLOWS THE COUPLE, NOT ONLY THE EVENT — CLOSED (controller sweep 2026-11-16; the proof was
 * #7841's `hole-3-the-fee-follows-the-event-not-the-couple.db.test.ts`, its HOLE OPEN assertion flipped here).
 *
 * Owner, Vendor_Monetization_Model_LOCKED_2026-07-25 §3: a couple Setnayan sourced to a shop is sourced for the first
 * booking AND EVERY REPEAT, stamped once at first contact (re-confirmed in specs DECISION_LOG 2026-11-16, "AN IMPORTED
 * CLIENT BOOKS FREE FOR LIFE WITH THE SUPPLIER WHO BROUGHT THEM": "a SOURCED client still pays on the first booking
 * and every repeat").
 *
 * The fix is migration 20271349691846: `booking_fee_attribution_for` keeps the per-event rule
 * (`booking_fee_attribution_for_event`) and adds one arm — a COUPLE member of this event who is a couple member of
 * another event where the shop is sourced (its frozen ledger stamp, else its facts), whose first contact with the shop
 * came no later than this event's (`booking_fee_first_contact_at`). The guard cases below pin what the arm must NOT
 * do: cross a coordinator's events, cross to a different couple, or re-stamp a shop's own earlier client.
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
     VALUES ($1, $2, 'Manila', ARRAY['catering']::text[], 'verified', TIMESTAMPTZ '2020-01-01', 'verified')
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

test('CLOSED · 3 — the same couple, sourced to a shop on event A, books it again on event B and B is sourced', async () => {
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

  // CLOSED (was HOLE OPEN 'import'): LOCKED §3, every repeat.
  assert.equal(await attribution(shop, eventB), 'sourced', 'booking_fee_attribution_for remembers the couple across events');
  // The per-event rule alone still reads B as an import — the carry is the new arm, not a changed per-event rule.
  const perEvent = await db.query<{ a: string }>(`SELECT public.booking_fee_attribution_for_event($1, $2) AS a`, [shop, eventB]);
  assert.equal(perEvent.rows[0]!.a, 'import');
});

/* ── what the same-couple arm must NOT do ── */

async function sourcedEvent(shop: string, member: string, memberType: 'couple' | 'coordinator', at: string): Promise<string> {
  const r = await db.query<{ event_id: string }>(
    `INSERT INTO public.events (display_name, event_type) VALUES ($1, 'birthday') RETURNING event_id`,
    [`Hole 3 ${++n}`],
  );
  const eventId = r.rows[0]!.event_id;
  await db.query(`INSERT INTO public.event_members (event_id, user_id, member_type) VALUES ($1, $2, $3)`, [eventId, member, memberType]);
  await db.query(
    `INSERT INTO public.event_vendors (event_id, marketplace_vendor_id, category, vendor_name, status, source, created_at)
     VALUES ($1, $2, 'catering', 'Kusina', 'considering', 'host_marketplace_search', $3)`,
    [eventId, shop, at],
  );
  return eventId;
}

/** Event B, where the shop is the first import — free unless the same-couple arm (wrongly) carries a fee in. With
 *  'host_manual' it would pay anyway since the owner's 16 Nov answer 3, which would make the guard cases vacuous. */
async function directEvent(shop: string, couple: string, at: string, source = 'vendor_invite'): Promise<string> {
  const eventId = await newEventFor(couple);
  await db.query(
    `INSERT INTO public.event_vendors (event_id, marketplace_vendor_id, category, vendor_name, status, source, created_at)
     VALUES ($1, $2, 'catering', 'Kusina', 'considering', $4, $3)`,
    [eventId, shop, at, source],
  );
  return eventId;
}

test('STILL IMPORT · a coordinator who planned a sourced event does not carry the fee to another couple\'s event', async () => {
  const shop = await newShop();
  const coordinator = await newUser('coord');
  await sourcedEvent(shop, coordinator, 'coordinator', '2026-10-01T00:00:00Z');
  const couple = await newUser('couple');
  const eventB = await directEvent(shop, couple, '2026-10-05T00:00:00Z');
  await db.query(`INSERT INTO public.event_members (event_id, user_id, member_type) VALUES ($1, $2, 'coordinator')`, [eventB, coordinator]);
  assert.equal(await attribution(shop, eventB), 'import');
});

test('STILL IMPORT · a different couple sourced to the same shop changes nothing', async () => {
  const shop = await newShop();
  await sourcedEvent(shop, await newUser('other'), 'couple', '2026-10-01T00:00:00Z');
  const eventB = await directEvent(shop, await newUser('couple'), '2026-10-05T00:00:00Z');
  assert.equal(await attribution(shop, eventB), 'import');
});

test('STILL IMPORT · first contact wins — the shop\'s own client on an EARLIER event is not re-stamped by a later find', async () => {
  const shop = await newShop();
  const couple = await newUser('couple');
  // Event A: the shop brought the couple first (their invite).
  const eventA = await directEvent(shop, couple, '2026-09-01T00:00:00Z', 'vendor_invite');
  // Event C, later: the couple saves the same shop from Find.
  await sourcedEvent(shop, couple, 'couple', '2026-10-01T00:00:00Z');
  assert.equal(await attribution(shop, eventA), 'import', 'the earlier own-client booking stays free');
});
