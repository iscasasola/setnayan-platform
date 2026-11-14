/**
 * 🚫 A HIDDEN SHOP TAKES NO NEW BOOKINGS — IN THE DATABASE (owner 2026-11-14: *"Yes, block them"*; migration
 * 20271346561709_a_hidden_shop_takes_no_new_ask_or_booking.sql).
 *
 * Writes go in as the migration owner, so NO app check runs — this is the app check bypassed, and the trigger
 * `enforce_booking_requires_verified_vendor` is the only thing under test.
 *
 * Fails if:
 *   1 · a verified shop at public_visibility = 'hidden' can be ASKED (lock_request_state → 'pending') or BOOKED;
 *   2 · an unverified shop can be asked (the ask was the app's alone);
 *   3 · a listed verified shop can no longer be asked or booked;
 *   4 · an EXISTING booking or an EXISTING ask with a shop that went hidden after it stops being editable, stops
 *       advancing, or its conversation stops taking messages — the rule refuses NEW requests only;
 *   5 · a LAPSED shop (papers past their date: badge off, still listed) is refused — it keeps the events that inquired.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';

import { createReplayedDb, type ReplayResult } from './replay-migrations';

let replay: ReplayResult;
let db: ReplayResult['db'];
let n = 0;

async function newUser(kind: 'customer'): Promise<string> {
  n += 1;
  const u = await db.query<{ id: string }>(
    `INSERT INTO auth.users (email, raw_user_meta_data) VALUES ($1, jsonb_build_object('account_type', $2::text)) RETURNING id`,
    [`hidden-gate-${n}@test.local`, kind],
  );
  return u.rows[0]!.id;
}

/** A shop: verified or not, and at the visibility given. */
async function newShop(state: 'verified' | 'unverified', visibility: 'verified' | 'hidden', renewalDue: string | null = null): Promise<string> {
  const owner = await newUser('customer');
  const v = await db.query<{ vendor_profile_id: string }>(
    `INSERT INTO public.vendor_profiles
       (user_id, business_name, location_city, services, verification_state, last_verified_at, public_visibility, next_renewal_due_at)
     VALUES ($1, 'Hidden Gate Shop', 'Manila', ARRAY['photography']::text[], $2::public.vendor_verification_state,
             CASE WHEN $2 = 'verified' THEN NOW() END, $3::public.vendor_public_visibility, $4::timestamptz)
     RETURNING vendor_profile_id`,
    [owner, state, visibility, renewalDue],
  );
  return v.rows[0]!.vendor_profile_id;
}

async function newEvent(): Promise<string> {
  const e = await db.query<{ event_id: string }>(
    `INSERT INTO public.events (display_name, event_type) VALUES ('Hidden Gate Event', 'birthday') RETURNING event_id`,
  );
  return e.rows[0]!.event_id;
}

async function attempt(sql: string, params: unknown[]): Promise<string | null> {
  try {
    await db.query(sql, params);
    return null;
  } catch (err) {
    return err instanceof Error ? err.message : String(err);
  }
}

/** A row the couple is considering, then the ask on it (an UPDATE, as `finalizeVendor` writes it). */
async function considering(eventId: string, shop: string): Promise<string> {
  const r = await db.query<{ vendor_id: string }>(
    `INSERT INTO public.event_vendors (event_id, category, vendor_name, status, marketplace_vendor_id)
     VALUES ($1, 'photographer', 'A Shop', 'considering', $2) RETURNING vendor_id`,
    [eventId, shop],
  );
  return r.rows[0]!.vendor_id;
}
const ask = (vendorId: string) =>
  attempt(
    `UPDATE public.event_vendors SET lock_request_state = 'pending', lock_requested_at = NOW() WHERE vendor_id = $1`,
    [vendorId],
  );
const askOnInsert = (eventId: string, shop: string) =>
  attempt(
    `INSERT INTO public.event_vendors (event_id, category, vendor_name, status, marketplace_vendor_id, lock_request_state, lock_requested_at)
     VALUES ($1, 'photographer', 'A Shop', 'considering', $2, 'pending', NOW())`,
    [eventId, shop],
  );
const book = (eventId: string, shop: string) =>
  attempt(
    `INSERT INTO public.event_vendors (event_id, category, vendor_name, status, marketplace_vendor_id)
     VALUES ($1, 'photographer', 'A Shop', 'contracted', $2)`,
    [eventId, shop],
  );

before(async () => {
  replay = await createReplayedDb();
  db = replay.db;
});

after(async () => {
  await db?.close();
});

test('1 · a HIDDEN verified shop cannot be asked (update or insert) or booked — with no app check in the way', async () => {
  const shop = await newShop('verified', 'hidden');
  const ev = await newEvent();
  const askErr = await ask(await considering(ev, shop));
  assert.match(String(askErr), /vendor_not_verified: .*reason=not_listed/, 'the ask is refused in the database');
  assert.match(String(await askOnInsert(await newEvent(), shop)), /reason=not_listed/, 'an ask inserted directly is refused');
  assert.match(String(await book(await newEvent(), shop)), /reason=not_listed/, 'a booking is refused');
});

test('2 · an UNVERIFIED shop cannot be asked either (the ask was the app’s alone)', async () => {
  const shop = await newShop('unverified', 'hidden');
  assert.match(String(await ask(await considering(await newEvent(), shop))), /reason=not_verified/);
});

test('3 · a listed verified shop can still be asked, and booked', async () => {
  const shop = await newShop('verified', 'verified');
  assert.equal(await ask(await considering(await newEvent(), shop)), null);
  assert.equal(await book(await newEvent(), shop), null);
});

test('4 · an EXISTING booking and an EXISTING ask survive the shop going hidden — and its conversation still talks', async () => {
  const shop = await newShop('verified', 'verified');
  const couple = await newUser('customer');
  const ev = await newEvent();
  const booked = await db.query<{ vendor_id: string }>(
    `INSERT INTO public.event_vendors (event_id, category, vendor_name, status, marketplace_vendor_id)
     VALUES ($1, 'photographer', 'A Shop', 'contracted', $2) RETURNING vendor_id`,
    [ev, shop],
  );
  const asked = await considering(await newEvent(), shop);
  assert.equal(await ask(asked), null);
  const thread = await db.query<{ thread_id: string }>(
    `INSERT INTO public.chat_threads (event_id, vendor_profile_id, created_by_user_id, inquiry_status)
     VALUES ($1, $2, $3, 'accepted') RETURNING thread_id`,
    [ev, shop, couple],
  );

  await db.query(`UPDATE public.vendor_profiles SET public_visibility = 'hidden' WHERE vendor_profile_id = $1`, [shop]);

  const id = booked.rows[0]!.vendor_id;
  assert.equal(await attempt(`UPDATE public.event_vendors SET notes = 'still ours' WHERE vendor_id = $1`, [id]), null, 'the booking is still editable');
  assert.equal(await attempt(`UPDATE public.event_vendors SET status = 'deposit_paid' WHERE vendor_id = $1`, [id]), null, 'and still advances');
  const read = await db.query<{ status: string }>(`SELECT status::text AS status FROM public.event_vendors WHERE vendor_id = $1`, [id]);
  assert.equal(read.rows[0]!.status, 'deposit_paid', 'and still reads');
  assert.equal(
    await attempt(`UPDATE public.event_vendors SET notes = 'nudged' WHERE vendor_id = $1`, [asked]),
    null,
    'an ask already out is not re-checked while it stays pending',
  );
  assert.equal(
    await attempt(
      `INSERT INTO public.chat_messages (thread_id, event_id, vendor_profile_id, sender_user_id, sender_role, body)
       VALUES ($1, $2, $3, $4, 'couple', 'hello again')`,
      [thread.rows[0]!.thread_id, ev, shop, couple],
    ),
    null,
    'the conversation still takes messages',
  );
  // …but the hidden shop's YES on that ask is a NEW booking, and is refused.
  assert.match(
    String(await attempt(`UPDATE public.event_vendors SET status = 'contracted', lock_request_state = 'agreed' WHERE vendor_id = $1`, [asked])),
    /reason=not_listed/,
  );
});

test('5 · a LAPSED shop (papers past their date, badge off, still listed) keeps taking asks and bookings', async () => {
  const shop = await newShop('verified', 'verified', '2026-03-30T00:00:00Z');
  assert.equal(await ask(await considering(await newEvent(), shop)), null);
  assert.equal(await book(await newEvent(), shop), null);
});
