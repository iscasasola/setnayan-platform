/**
 * Free-tier concurrent-booking cap — end-to-end (test:db, migrations replayed).
 *
 * Proves `enforce_free_tier_booking_cap` (20271001120000, rewritten by
 * 20271004541679) against real SQL:
 *   • INERT while platform_settings.free_tier_booking_cap_enabled is FALSE
 *     (its default) — the flag-dark claim, asserted rather than asserted-about
 *   • three DISTINCT events DO cap the 4th; paid tiers never cap
 *   • ONE BOOKING = ONE EVENT. The cap counts DISTINCT event_id, so duplicate
 *     ACTIVE rows for the same (event, vendor) — reachable through ARCHIVED
 *     rows, which the `event_vendors_unique_marketplace_pick_per_event` partial
 *     index does not cover — cannot burn a second concurrent slot.
 *   • the couple's OWN event never counts against them
 *   • an already-active row's lifecycle advance is never re-counted
 *   • a completed event frees a slot
 *   • the raised message carries the `free_tier_booking_cap` token the app-side
 *     detector matches on, and does NOT carry Setnayan's internal vendor id
 *
 * SCOPE NOTE on the row-vs-event fix. The review that prompted 20271004541679
 * described "one 4-item package booking exhausts the cap" — one package writing
 * four active event_vendors rows for the same vendor in one event. That exact
 * scenario does NOT reproduce: `event_vendors_unique_marketplace_pick_per_event`
 * (20260625050739) already forbids two ACTIVE, NON-ARCHIVED rows per
 * (event_id, marketplace_vendor_id) — the second row throws 23505 first. (Which
 * means `lockPackage`'s multi-item cascade cannot commit today at all — a
 * separate, pre-existing defect, not this trigger's.) The window that IS real
 * is archived duplicates, covered below. COUNT(DISTINCT) is the correct
 * expression of "3 concurrent BOOKINGS" either way.
 *
 * The app-side halves are covered in lib/vendor-free-tier-booking-cap-ui.test.ts
 * (detector, copy, distinct counting) — this locks the DB half.
 *
 * Rows are seeded as the migration owner (no setAuthUid) so the TRIGGER — not
 * RLS — is what's under test. Vendors are VERIFIED so the sibling
 * booking-requires-verified trigger never fires and masks this one.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';

import { createReplayedDb, type ReplayResult } from './replay-migrations';

let replay: ReplayResult;
let db: ReplayResult['db'];

let seq = 0;

/** A VERIFIED marketplace vendor at the given tier_state. */
async function newVendor(tier: string): Promise<string> {
  seq += 1;
  const u = await db.query<{ id: string }>(
    `INSERT INTO auth.users (email, raw_user_meta_data)
     VALUES ($1, jsonb_build_object('account_type','customer')) RETURNING id`,
    [`cap-${seq}@captest.test`],
  );
  const v = await db.query<{ vendor_profile_id: string }>(
    `INSERT INTO public.vendor_profiles
       (user_id, business_name, location_city, services, verification_state, tier_state)
     VALUES ($1, 'Cap Test Vendor', 'Manila', ARRAY['photography']::text[],
             'verified', $2::public.vendor_tier_state)
     RETURNING vendor_profile_id`,
    [u.rows[0]!.id, tier],
  );
  return v.rows[0]!.vendor_profile_id;
}

async function newEvent(): Promise<string> {
  seq += 1;
  const e = await db.query<{ event_id: string }>(
    `INSERT INTO public.events (display_name, event_type)
     VALUES ($1, 'birthday') RETURNING event_id`,
    [`Cap Event ${seq}`],
  );
  return e.rows[0]!.event_id;
}

/**
 * INSERT one active (contracted) event_vendors row. Returns the error message,
 * or null when it committed.
 */
async function tryLock(
  eventId: string,
  vendorProfileId: string,
  category = 'photographer',
): Promise<string | null> {
  try {
    await db.query(
      `INSERT INTO public.event_vendors
         (event_id, category, vendor_name, status, marketplace_vendor_id)
       VALUES ($1, $2, 'Cap Test Vendor', 'contracted', $3)`,
      [eventId, category, vendorProfileId],
    );
    return null;
  } catch (err) {
    return err instanceof Error ? err.message : String(err);
  }
}

async function setCapEnabled(on: boolean): Promise<void> {
  await db.query(
    `UPDATE public.platform_settings SET free_tier_booking_cap_enabled = $1 WHERE id = 1`,
    [on],
  );
}

/** Fill `n` DISTINCT events with an active lock; returns their event ids. */
async function fillEvents(vendorProfileId: string, n: number): Promise<string[]> {
  const ids: string[] = [];
  for (let i = 0; i < n; i += 1) {
    const e = await newEvent();
    const err = await tryLock(e, vendorProfileId);
    assert.equal(err, null, `seeding event ${i + 1} should not be capped`);
    ids.push(e);
  }
  return ids;
}

before(async () => {
  replay = await createReplayedDb();
  db = replay.db;
});

after(async () => {
  await db?.close();
});

// ── flag-dark ───────────────────────────────────────────────────────────────

test('the default of free_tier_booking_cap_enabled is FALSE', async () => {
  const d = await db.query<{ column_default: string | null }>(
    `SELECT column_default FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'platform_settings'
        AND column_name = 'free_tier_booking_cap_enabled'`,
  );
  assert.equal(d.rows.length, 1, 'the master switch column must exist');
  assert.match(String(d.rows[0]!.column_default), /false/i);
});

test('flag-dark: with the platform_settings switch FALSE the cap is inert', async () => {
  await setCapEnabled(false);
  const vendor = await newVendor('free');
  for (let i = 0; i < 10; i += 1) {
    const e = await newEvent();
    assert.equal(
      await tryLock(e, vendor),
      null,
      'nothing may be refused while the switch is FALSE',
    );
  }
});

// ── the cap itself ──────────────────────────────────────────────────────────

test('three DISTINCT events DO cap the 4th', async () => {
  await setCapEnabled(true);
  const vendor = await newVendor('free');
  await fillEvents(vendor, 3);

  const err = await tryLock(await newEvent(), vendor);
  assert.ok(err, 'a 4th distinct event must be refused');
  assert.match(String(err), /free_tier_booking_cap/);
});

test('the refusal carries the app detector’s token and NOT the internal vendor id', async () => {
  await setCapEnabled(true);
  const vendor = await newVendor('free');
  await fillEvents(vendor, 3);

  const err = String(await tryLock(await newEvent(), vendor));
  assert.match(err, /free_tier_booking_cap/);
  assert.equal(
    err.includes(vendor),
    false,
    'the raised message is rethrown verbatim on some paths — it must not leak the vendor_profile_id',
  );
});

test('the "verified" free tier is capped the same as "free"', async () => {
  await setCapEnabled(true);
  const vendor = await newVendor('verified');
  await fillEvents(vendor, 3);
  assert.match(String(await tryLock(await newEvent(), vendor)), /free_tier_booking_cap/);
});

test('PAID tiers are never capped', async () => {
  await setCapEnabled(true);
  for (const tier of ['solo', 'pro', 'enterprise']) {
    const vendor = await newVendor(tier);
    await fillEvents(vendor, 3);
    assert.equal(
      await tryLock(await newEvent(), vendor),
      null,
      `${tier} is unlimited and must never be capped`,
    );
  }
});

// ── ONE BOOKING = ONE EVENT ─────────────────────────────────────────────────

test('the platform already forbids two ACTIVE rows per (event, vendor)', async () => {
  // Documents WHY the row-vs-event gap is narrow — and pins the constraint the
  // scope note above depends on. If this ever stops throwing, the row-counting
  // defect becomes wide again and the DISTINCT count is what stops it.
  await setCapEnabled(false);
  const vendor = await newVendor('free');
  const event = await newEvent();
  assert.equal(await tryLock(event, vendor, 'photographer'), null);
  assert.match(
    String(await tryLock(event, vendor, 'videographer')),
    /event_vendors_unique_marketplace_pick_per_event/,
  );
});

test('ONE BOOKING = ONE EVENT: an archived duplicate cannot burn a second slot', async () => {
  // The real window the DISTINCT count closes. The partial unique index skips
  // `archived_at IS NOT NULL` rows, so one event CAN hold two active-status
  // rows for the same vendor (one archived). Under the shipped COUNT(*) that
  // read as TWO concurrent bookings.
  await setCapEnabled(false);
  const vendor = await newVendor('free');

  const shared = await newEvent();
  assert.equal(await tryLock(shared, vendor), null);
  await db.query(
    `UPDATE public.event_vendors SET archived_at = now()
      WHERE event_id = $1 AND marketplace_vendor_id = $2`,
    [shared, vendor],
  );
  // Re-lock in the SAME event — now legal, the archived row is out of the index.
  assert.equal(await tryLock(shared, vendor, 'videographer'), null);

  const second = await newEvent();
  assert.equal(await tryLock(second, vendor), null);

  // Rows in OTHER events, from a 3rd event's point of view: 3 (one archived).
  // Distinct events: 2. COUNT(*) refuses here; COUNT(DISTINCT event_id) allows.
  await setCapEnabled(true);
  assert.equal(
    await tryLock(await newEvent(), vendor),
    null,
    'the vendor holds TWO concurrent bookings, not three — a duplicate row in one event is still one booking',
  );
});

test('the couple’s OWN event never counts against them', async () => {
  await setCapEnabled(false);
  const vendor = await newVendor('free');
  const events = await fillEvents(vendor, 3); // exactly AT the cap
  await setCapEnabled(true);

  // Re-lock inside one of the vendor's OWN existing events (archive first so
  // the unique index allows the second row). The archived row keeps
  // status='contracted', so WITHOUT the trigger's `ev.event_id <> NEW.event_id`
  // this would count 3 and refuse; WITH it the count is 2 and the re-lock
  // passes. A couple must never be blocked from re-locking their own vendor.
  await db.query(
    `UPDATE public.event_vendors SET archived_at = now()
      WHERE event_id = $1 AND marketplace_vendor_id = $2`,
    [events[0]!, vendor],
  );
  assert.equal(
    await tryLock(events[0]!, vendor, 'videographer'),
    null,
    're-locking inside my own event must never be refused',
  );
});

test('OFF-PLATFORM vendors (no marketplace_vendor_id) are never capped', async () => {
  await setCapEnabled(true);
  for (let i = 0; i < 5; i += 1) {
    const e = await newEvent();
    let err: string | null = null;
    try {
      await db.query(
        `INSERT INTO public.event_vendors (event_id, category, vendor_name, status)
         VALUES ($1, 'photographer', 'Off Platform', 'contracted')`,
        [e],
      );
    } catch (x) {
      err = x instanceof Error ? x.message : String(x);
    }
    assert.equal(err, null, 'off-platform vendors carry no tier and are never capped');
  }
});

test('a lifecycle advance of an ALREADY-active lock is not re-counted', async () => {
  await setCapEnabled(false);
  const vendor = await newVendor('free');
  const events = await fillEvents(vendor, 4); // 4 concurrent, seeded switch-off
  await setCapEnabled(true);

  // contracted → deposit_paid on an existing row: already active, so the
  // trigger must return early rather than re-count (3 others) and refuse.
  await db.query(
    `UPDATE public.event_vendors SET status = 'deposit_paid'
      WHERE event_id = $1 AND marketplace_vendor_id = $2`,
    [events[0]!, vendor],
  );
  const check = await db.query<{ status: string }>(
    `SELECT status FROM public.event_vendors
      WHERE event_id = $1 AND marketplace_vendor_id = $2`,
    [events[0]!, vendor],
  );
  assert.equal(check.rows[0]!.status, 'deposit_paid');
});

test('a COMPLETED event frees a slot', async () => {
  await setCapEnabled(true);
  const vendor = await newVendor('free');
  const events = await fillEvents(vendor, 3);
  assert.ok(await tryLock(await newEvent(), vendor), 'capped at 3');

  // 'complete' is outside the active set.
  await db.query(
    `UPDATE public.event_vendors SET status = 'complete'
      WHERE event_id = $1 AND marketplace_vendor_id = $2`,
    [events[0]!, vendor],
  );
  assert.equal(
    await tryLock(await newEvent(), vendor),
    null,
    'finishing an event must free a concurrent slot',
  );
});
