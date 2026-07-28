/**
 * Booking-requires-verified gate — end-to-end (test:db, migrations replayed).
 *
 * Proves the enforce_booking_requires_verified_vendor trigger
 * (20270927437859) actually blocks a couple from booking / locking a MARKETPLACE
 * vendor whose vendor_profiles.verification_state ≠ 'verified', across the
 * INSERT and UPDATE write paths — while:
 *   • letting VERIFIED marketplace vendors lock,
 *   • never gating OFF-PLATFORM vendors (marketplace_vendor_id IS NULL),
 *   • never gating non-booking statuses (considering / shortlisted),
 *   • GRANDFATHERING existing locks (a demotion after the lock, or any later
 *     edit of an already-confirmed row, is never re-checked).
 *
 * The pure app-side half (isMarketplaceVendorBookable / isBookableVerification-
 * State) is covered in lib/vendor-verification.test.ts; this locks the DB half.
 *
 * Rows are seeded as the migration owner (setAuthUid null) so the trigger — not
 * RLS — is what's under test.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';

import { createReplayedDb, type ReplayResult } from './replay-migrations';

let replay: ReplayResult;
let db: ReplayResult['db'];

/** A vendor_profiles row in the given verification_state. */
async function newVendor(
  email: string,
  state: 'unverified' | 'pending_review' | 'verified' | 'demoted' | 'rejected',
): Promise<string> {
  // account_type='customer' avoids the on_auth_user_created auto-provisioning of
  // a vendor_profiles row (which would collide with the explicit INSERT below);
  // we create + state the profile by hand — same pattern as the price-history
  // DB test.
  const u = await db.query<{ id: string }>(
    `INSERT INTO auth.users (email, raw_user_meta_data)
     VALUES ($1, jsonb_build_object('account_type','customer')) RETURNING id`,
    [email],
  );
  const v = await db.query<{ vendor_profile_id: string }>(
    // `last_verified_at` is stamped ONLY for the 'verified' state, mirroring the
    // admin approval path — `vendor_profiles_verified_requires_stamp`
    // (20271017100000) rejects a verified row without it, and the other four
    // states legitimately have no verification date.
    `INSERT INTO public.vendor_profiles (user_id, business_name, location_city, services, verification_state, last_verified_at)
     VALUES ($1, 'Book Gate Vendor', 'Manila', ARRAY['photography']::text[], $2::public.vendor_verification_state,
             CASE WHEN $2 = 'verified' THEN NOW() END)
     RETURNING vendor_profile_id`,
    [u.rows[0]!.id, state],
  );
  return v.rows[0]!.vendor_profile_id;
}

async function newEvent(): Promise<string> {
  const e = await db.query<{ event_id: string }>(
    `INSERT INTO public.events (display_name, event_type)
     VALUES ('Book Gate Event', 'birthday') RETURNING event_id`,
  );
  return e.rows[0]!.event_id;
}

/** Try to INSERT an event_vendors row; returns the error message or null. */
async function tryInsertVendor(
  eventId: string,
  opts: { marketplaceVendorId: string | null; status: string },
): Promise<string | null> {
  try {
    await db.query(
      `INSERT INTO public.event_vendors (event_id, category, vendor_name, status, marketplace_vendor_id)
       VALUES ($1, 'photographer', 'Some Vendor', $2::public.vendor_status, $3)`,
      [eventId, opts.status, opts.marketplaceVendorId],
    );
    return null;
  } catch (err) {
    return err instanceof Error ? err.message : String(err);
  }
}

before(async () => {
  replay = await createReplayedDb();
  db = replay.db;
});

after(async () => {
  await db?.close();
});

test('a VERIFIED marketplace vendor CAN be locked (INSERT contracted)', async () => {
  const event = await newEvent();
  const vendor = await newVendor('verified@bookgate.test', 'verified');
  const err = await tryInsertVendor(event, {
    marketplaceVendorId: vendor,
    status: 'contracted',
  });
  assert.equal(err, null, 'verified vendor should lock without error');
});

test('an UNVERIFIED marketplace vendor CANNOT be locked (INSERT contracted throws)', async () => {
  const event = await newEvent();
  const vendor = await newVendor('unverified@bookgate.test', 'unverified');
  const err = await tryInsertVendor(event, {
    marketplaceVendorId: vendor,
    status: 'contracted',
  });
  assert.ok(err, 'an unverified vendor lock must throw');
  assert.match(String(err), /vendor_not_verified/);
});

test('pending_review / demoted / rejected marketplace vendors also cannot be locked', async () => {
  const event = await newEvent();
  for (const state of ['pending_review', 'demoted', 'rejected'] as const) {
    const vendor = await newVendor(`${state}@bookgate.test`, state);
    const err = await tryInsertVendor(event, {
      marketplaceVendorId: vendor,
      status: 'contracted',
    });
    assert.ok(err, `${state} vendor must not lock`);
    assert.match(String(err), /vendor_not_verified/);
  }
});

test('an UNVERIFIED vendor CAN still be shortlisted (non-booking statuses pass)', async () => {
  const vendor = await newVendor('shortlist@bookgate.test', 'unverified');
  // Each status in its own event so a per-(event,vendor) uniqueness constraint
  // can't mask the point (the trigger, not uniqueness, is under test).
  for (const status of ['considering', 'shortlisted'] as const) {
    const event = await newEvent();
    const err = await tryInsertVendor(event, {
      marketplaceVendorId: vendor,
      status,
    });
    assert.equal(err, null, `${status} must be allowed for an unverified vendor`);
  }
});

test('OFF-PLATFORM vendors (no marketplace_vendor_id) are never gated', async () => {
  const event = await newEvent();
  const err = await tryInsertVendor(event, {
    marketplaceVendorId: null,
    status: 'contracted',
  });
  assert.equal(err, null, 'off-platform lock must pass regardless of verification');
});

test('UPDATE considering→contracted is blocked for an unverified vendor, allowed for a verified one', async () => {
  const event = await newEvent();

  // Unverified: seed a considering row (allowed), then try to flip to contracted.
  const unverified = await newVendor('upd-unverified@bookgate.test', 'unverified');
  const uRow = await db.query<{ vendor_id: string }>(
    `INSERT INTO public.event_vendors (event_id, category, vendor_name, status, marketplace_vendor_id)
     VALUES ($1, 'photographer', 'Upd Unverified', 'considering', $2) RETURNING vendor_id`,
    [event, unverified],
  );
  let blocked: string | null = null;
  try {
    await db.query(
      `UPDATE public.event_vendors SET status = 'contracted' WHERE vendor_id = $1`,
      [uRow.rows[0]!.vendor_id],
    );
  } catch (err) {
    blocked = err instanceof Error ? err.message : String(err);
  }
  assert.ok(blocked, 'considering→contracted must throw for an unverified vendor');
  assert.match(String(blocked), /vendor_not_verified/);

  // Verified: same transition succeeds.
  const verified = await newVendor('upd-verified@bookgate.test', 'verified');
  const vRow = await db.query<{ vendor_id: string }>(
    `INSERT INTO public.event_vendors (event_id, category, vendor_name, status, marketplace_vendor_id)
     VALUES ($1, 'photographer', 'Upd Verified', 'considering', $2) RETURNING vendor_id`,
    [event, verified],
  );
  await db.query(
    `UPDATE public.event_vendors SET status = 'contracted' WHERE vendor_id = $1`,
    [vRow.rows[0]!.vendor_id],
  );
  const check = await db.query<{ status: string }>(
    `SELECT status FROM public.event_vendors WHERE vendor_id = $1`,
    [vRow.rows[0]!.vendor_id],
  );
  assert.equal(check.rows[0]!.status, 'contracted', 'verified vendor should flip to contracted');
});

test('GRANDFATHERING: an existing lock survives the vendor being demoted afterwards', async () => {
  const event = await newEvent();
  const vendor = await newVendor('grandfather@bookgate.test', 'verified');

  // Lock while verified.
  const row = await db.query<{ vendor_id: string }>(
    `INSERT INTO public.event_vendors (event_id, category, vendor_name, status, marketplace_vendor_id)
     VALUES ($1, 'photographer', 'Grandfathered', 'contracted', $2) RETURNING vendor_id`,
    [event, vendor],
  );
  const vendorRowId = row.rows[0]!.vendor_id;

  // Vendor is later DEMOTED.
  await db.query(
    `UPDATE public.vendor_profiles SET verification_state = 'demoted' WHERE vendor_profile_id = $1`,
    [vendor],
  );

  // A lifecycle advance of the already-confirmed row still works (grandfathered).
  await db.query(
    `UPDATE public.event_vendors SET status = 'deposit_paid' WHERE vendor_id = $1`,
    [vendorRowId],
  );

  // A plain edit of the already-confirmed row also works.
  await db.query(
    `UPDATE public.event_vendors SET notes = 'edited after demotion' WHERE vendor_id = $1`,
    [vendorRowId],
  );

  const check = await db.query<{ status: string; notes: string | null }>(
    `SELECT status, notes FROM public.event_vendors WHERE vendor_id = $1`,
    [vendorRowId],
  );
  assert.equal(check.rows[0]!.status, 'deposit_paid', 'grandfathered lock advanced');
  assert.equal(check.rows[0]!.notes, 'edited after demotion', 'grandfathered lock edited');
});
