/**
 * 🚪 BOOKINGS CLOSED — the database half (owner 2026-11-02: *"for now, they cannot add bookings"*).
 *
 * Migration 20271302310560_bookings_closed_switch.sql adds `platform_settings.bookings_open` and the trigger
 * `event_vendors_require_bookings_open`. This proves, on a replay that keeps the switch AS MIGRATED:
 *   1 · the launch default is closed (NULL, and `bookings_are_open()` says false);
 *   2 · closed ⇒ no marketplace row moves into a booked status — INSERT or UPDATE, verified shop or not —
 *       which is every booking door (the couple's five, the supplier's yes, a Locked-QR claim, a payment
 *       acknowledgement) since each of them books by that one transition;
 *   3 · closed still lets through what is not a supplier booking: the couple's own hand-added rows, a
 *       shortlist, and a claim approval's link stamped onto an already-booked hand-added row (the founders'
 *       event, "cater our event");
 *   4 · open (TRUE) ⇒ today's behaviour exactly: a verified shop books, an unverified one is still refused by
 *       the verified trigger; FALSE is closed again.
 * The app half (each door asks first, the fee mint makes nothing) is `lib/bookings-closed-doors.test.ts`.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';

import { createReplayedDb, type ReplayResult } from './replay-migrations';

let replay: ReplayResult;
let db: ReplayResult['db'];

async function newVendor(email: string, state: 'unverified' | 'verified'): Promise<string> {
  const u = await db.query<{ id: string }>(
    `INSERT INTO auth.users (email, raw_user_meta_data)
     VALUES ($1, jsonb_build_object('account_type','customer')) RETURNING id`,
    [email],
  );
  const v = await db.query<{ vendor_profile_id: string }>(
    `INSERT INTO public.vendor_profiles (user_id, business_name, location_city, services, verification_state, last_verified_at, public_visibility)
     VALUES ($1, 'Closed Gate Vendor', 'Manila', ARRAY['photography']::text[], $2::public.vendor_verification_state,
             CASE WHEN $2 = 'verified' THEN NOW() END,
             (CASE WHEN $2 = 'verified' THEN 'verified' ELSE 'hidden' END)::public.vendor_public_visibility)
     RETURNING vendor_profile_id`,
    [u.rows[0]!.id, state],
  );
  return v.rows[0]!.vendor_profile_id;
}

async function newEvent(): Promise<string> {
  const e = await db.query<{ event_id: string }>(
    `INSERT INTO public.events (display_name, event_type) VALUES ('Closed Gate Event', 'birthday') RETURNING event_id`,
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

const insertRow = (eventId: string, marketplaceVendorId: string | null, status: string) =>
  attempt(
    `INSERT INTO public.event_vendors (event_id, category, vendor_name, status, marketplace_vendor_id)
     VALUES ($1, 'photographer', 'Some Vendor', $2::public.vendor_status, $3)`,
    [eventId, status, marketplaceVendorId],
  );

async function setSwitch(value: boolean | null): Promise<void> {
  await db.query(`UPDATE public.platform_settings SET bookings_open = $1 WHERE id = 1`, [value]);
}

before(async () => {
  replay = await createReplayedDb({ bookingsAsMigrated: true });
  db = replay.db;
});

after(async () => {
  await db?.close();
});

test('1 · as migrated, bookings are CLOSED — the switch is NULL and bookings_are_open() is false', async () => {
  const r = await db.query<{ v: boolean | null; open: boolean }>(
    `SELECT (SELECT bookings_open FROM public.platform_settings WHERE id = 1) AS v, public.bookings_are_open() AS open`,
  );
  assert.equal(r.rows[0]!.v, null, 'the migration must leave the switch unset (closed), not open');
  assert.equal(r.rows[0]!.open, false);
});

test('2 · closed: a VERIFIED shop cannot be booked — INSERT booked is refused with bookings_closed', async () => {
  await setSwitch(null);
  const event = await newEvent();
  const vendor = await newVendor('closed-insert@gate.test', 'verified');
  for (const status of ['contracted', 'deposit_paid', 'delivered', 'complete']) {
    const err = await insertRow(event, vendor, status);
    assert.match(String(err), /bookings_closed/, `INSERT ${status} must be refused while closed`);
  }
});

test('2 · closed: the yes / a payment acknowledgement cannot flip an ask into a booking (UPDATE refused)', async () => {
  await setSwitch(false);
  const event = await newEvent();
  const vendor = await newVendor('closed-update@gate.test', 'verified');
  assert.equal(await insertRow(event, vendor, 'considering'), null, 'an ask / shortlist row is allowed');
  const flip = await attempt(
    `UPDATE public.event_vendors SET status = 'contracted' WHERE event_id = $1 AND marketplace_vendor_id = $2`,
    [event, vendor],
  );
  assert.match(String(flip), /bookings_closed/, 'considering → contracted must be refused while closed');
  const paid = await attempt(
    `UPDATE public.event_vendors SET status = 'deposit_paid' WHERE event_id = $1 AND marketplace_vendor_id = $2`,
    [event, vendor],
  );
  assert.match(String(paid), /bookings_closed/, 'considering → deposit_paid must be refused while closed');
});

test('3 · closed: the couple’s own rows, a shortlist, and a claim approval’s link still go through', async () => {
  await setSwitch(null);
  const event = await newEvent();
  // The couple's own hand-added tracker row — never a supplier booking.
  assert.equal(await insertRow(event, null, 'deposit_paid'), null, 'an off-platform row books while closed');
  // A claim approval: the hand-added row is booked while off-platform, THEN linked to the claiming shop
  // (claim_link_record_to_shop). An unverified shop, as on the founders' event.
  const shop = await newVendor('closed-claim@gate.test', 'unverified');
  const link = await attempt(
    `UPDATE public.event_vendors SET marketplace_vendor_id = $2 WHERE event_id = $1 AND marketplace_vendor_id IS NULL`,
    [event, shop],
  );
  assert.equal(link, null, 'linking a shop onto an already-booked row is grandfathered while closed');
  const shortlist = await newVendor('closed-shortlist@gate.test', 'verified');
  assert.equal(await insertRow(await newEvent(), shortlist, 'shortlisted'), null, 'a shortlist is not a booking');
});

test('4 · open: today’s behaviour exactly — verified books, unverified is still refused by verification', async () => {
  await setSwitch(true);
  const r = await db.query<{ open: boolean }>(`SELECT public.bookings_are_open() AS open`);
  assert.equal(r.rows[0]!.open, true);
  const event = await newEvent();
  const verified = await newVendor('open-verified@gate.test', 'verified');
  assert.equal(await insertRow(event, verified, 'contracted'), null, 'a verified shop books while open');
  const unverified = await newVendor('open-unverified@gate.test', 'unverified');
  const err = await insertRow(await newEvent(), unverified, 'contracted');
  assert.match(String(err), /vendor_not_verified/, 'opening bookings must not open them to unverified shops');
  assert.doesNotMatch(String(err), /bookings_closed/);
});

test('4 · closing again after a booking: the booked row lives on (grandfathered), new ones are refused', async () => {
  await setSwitch(true);
  const event = await newEvent();
  const vendor = await newVendor('reclose@gate.test', 'verified');
  assert.equal(await insertRow(event, vendor, 'contracted'), null);
  await setSwitch(false);
  const step = await attempt(
    `UPDATE public.event_vendors SET status = 'deposit_paid' WHERE event_id = $1 AND marketplace_vendor_id = $2`,
    [event, vendor],
  );
  assert.equal(step, null, 'an already-booked row moving up the ladder is never re-checked');
  assert.match(String(await insertRow(await newEvent(), vendor, 'contracted')), /bookings_closed/);
});
