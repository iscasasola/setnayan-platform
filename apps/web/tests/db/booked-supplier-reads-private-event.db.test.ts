/**
 * THE BOOKED SUPPLIER ON A PRIVATE EVENT — the SQL half, against replayed
 * migrations.
 *
 * `app/[slug]/page.tsx` now admits a booked supplier past the private lock
 * screen as a fifth path, using the same read the doorway uses
 * (`loadVendorBooking`). The unit suite
 * (`app/[slug]/_lib/vendor-private-admission.test.ts`) pins the DECISION; this
 * file pins the FACTS that decision is made from, in real Postgres:
 *
 *   • the link + status the loader reads really do come back for a booked
 *     supplier, and really do distinguish a booking from a mere listing;
 *   • a supplier holding SEVERAL rows on one event (the package-booking shape)
 *     resolves to the COMMITTED row, not to whichever Postgres returned first;
 *   • the columns the loader selects CANNOT carry a guest's name — asserted on
 *     an event deliberately seeded WITH guests, because a test that only checks
 *     the happy path passes while leaking.
 *
 * Run: pnpm --filter @setnayan/web test:db
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';

import { createReplayedDb, type ReplayResult } from './replay-migrations';
import { COMMITTED_BOOKING_STATUSES } from '../../lib/vendor-addon-first5-free';

let replay: ReplayResult;
let db: ReplayResult['db'];

before(async () => {
  replay = await createReplayedDb();
  db = replay.db;
});

after(async () => {
  await db?.close();
});

async function newVendorAccount(email: string, businessName: string) {
  const u = await db.query<{ id: string }>(
    `INSERT INTO auth.users (email, raw_user_meta_data)
     VALUES ($1, jsonb_build_object('account_type','customer')) RETURNING id`,
    [email],
  );
  const userId = u.rows[0]!.id;
  const v = await db.query<{ vendor_profile_id: string }>(
    `INSERT INTO public.vendor_profiles
       (user_id, business_name, location_city, services, verification_state, last_verified_at)
     VALUES ($1, $2, 'Manila', ARRAY['photography']::text[], 'verified', NOW())
     RETURNING vendor_profile_id`,
    [userId, businessName],
  );
  return { userId, vendorProfileId: v.rows[0]!.vendor_profile_id };
}

async function newPrivateEventWithGuests(name: string) {
  // `/[slug]` is the wedding surface, and `events_wedding_fields_consistency`
  // is a biconditional: a wedding MUST carry ceremony_type + venue_setting.
  const e = await db.query<{ event_id: string }>(
    `INSERT INTO public.events
       (display_name, event_type, landing_page_visibility, ceremony_type, venue_setting)
     VALUES ($1, 'wedding', 'private', 'catholic', 'banquet_hall') RETURNING event_id`,
    [name],
  );
  const eventId = e.rows[0]!.event_id;
  // The event is seeded WITH guest names on purpose — every assertion about
  // what the supplier cannot see is worthless on an empty guest list.
  for (const [first, last] of [
    ['Maria', 'Santos'],
    ['Jose', 'Rizal'],
    ['Andres', 'Bonifacio'],
  ] as const) {
    await db.query(
      `INSERT INTO public.guests
         (event_id, first_name, last_name, display_name, email, side, group_category)
       VALUES ($1, $2, $3, $4, $5, 'bride', 'family')`,
      [eventId, first, last, `${first} ${last}`, `${first.toLowerCase()}@guest.test`],
    );
  }
  return eventId;
}

/** The loader's query, verbatim in SQL: the two columns it selects, narrowed to
 *  the businesses this user owns. Kept in one place so a drift in what the
 *  loader reads shows up here as a changed shape, not as a silent pass. */
async function readBookingRows(eventId: string, userId: string) {
  const r = await db.query<{ linked_vendor_profile_id: string | null; status: string }>(
    `SELECT ev.linked_vendor_profile_id, ev.status::text AS status
       FROM public.event_vendors ev
      WHERE ev.event_id = $1
        AND ev.linked_vendor_profile_id IN (
              SELECT vp.vendor_profile_id FROM public.vendor_profiles vp WHERE vp.user_id = $2
            )`,
    [eventId, userId],
  );
  return r.rows;
}

test('a BOOKED supplier resolves to a committed row — the gate can admit them', async () => {
  const { userId, vendorProfileId } = await newVendorAccount(
    'booked@supplier.test',
    'San Marco Catering',
  );
  const eventId = await newPrivateEventWithGuests('booked-supplier-private');
  await db.query(
    `INSERT INTO public.event_vendors
       (event_id, category, vendor_name, status, marketplace_vendor_id, linked_vendor_profile_id)
     VALUES ($1, 'catering', 'San Marco Catering', 'contracted', $2, $2)`,
    [eventId, vendorProfileId],
  );

  const rows = await readBookingRows(eventId, userId);
  assert.equal(rows.length, 1, 'the booked supplier must resolve on this event');
  assert.equal(rows[0]!.linked_vendor_profile_id, vendorProfileId);
  assert.ok(
    (COMMITTED_BOOKING_STATUSES as readonly string[]).includes(rows[0]!.status),
    'a locked row must carry a committed status',
  );
});

test('a LINKED but shortlisted supplier is NOT a booking — the reuse-accept row', async () => {
  const { userId, vendorProfileId } = await newVendorAccount(
    'shortlisted@supplier.test',
    'Reuse Florals',
  );
  const eventId = await newPrivateEventWithGuests('shortlisted-supplier-private');
  // Exactly what `acceptReuseRequest` mints: linked, priced, still 'shortlisted'
  // because the couple has not locked it.
  await db.query(
    `INSERT INTO public.event_vendors
       (event_id, category, vendor_name, status, marketplace_vendor_id, linked_vendor_profile_id, source)
     VALUES ($1, 'florist', 'Reuse Florals', 'shortlisted', $2, $2, 'reuse_accept')`,
    [eventId, vendorProfileId],
  );

  const rows = await readBookingRows(eventId, userId);
  assert.equal(rows.length, 1, 'the row exists and IS linked — that is the trap');
  assert.equal(
    (COMMITTED_BOOKING_STATUSES as readonly string[]).includes(rows[0]!.status),
    false,
    'a shortlisted reuse row must not read as a booking',
  );
});

test('ONE supplier, TWO rows on one event → the COMMITTED row decides, not row order', async () => {
  // ⚠ TWO CORRECTIONS TO THE OBVIOUS VERSION OF THIS TEST, both measured:
  //
  //   1. NOT "two businesses". `vendor_profiles.user_id` is UNIQUE — an account
  //      has exactly one shop — so a supplier can never own two profiles.
  //   2. The extra row cannot simply be a second category:
  //      `event_vendors_unique_marketplace_pick_per_event` is a UNIQUE index on
  //      (event_id, marketplace_vendor_id). It is PARTIAL, though — it excludes
  //      `package_role = 'covered'` and archived rows — and a PACKAGE booking
  //      cascades exactly that: one anchor row plus a covered row per kept line,
  //      all for one supplier. That is the reachable multi-row shape, so it is
  //      the one seeded here.
  //
  // (An earlier draft of this comment claimed production already carries a
  //  duplicate link. It does not — that count included the NULL bucket. All 45
  //  production rows have a NULL link. Re-measured: zero.)
  //
  // The old `.limit(1)` made "does this supplier get into the private page?" a
  // coin flip between such rows; the read now prefers the committed one.
  const { userId, vendorProfileId } = await newVendorAccount(
    'tworows@supplier.test',
    'Same Person Studio',
  );
  const eventId = await newPrivateEventWithGuests('two-rows-private');

  // Insert the NOT-YET-BOOKED row FIRST so a naive "first row wins" read picks it.
  await db.query(
    `INSERT INTO public.event_vendors
       (event_id, category, vendor_name, status, linked_vendor_profile_id, package_role)
     VALUES ($1, 'makeup_artist', 'Same Person Studio', 'shortlisted', $2, 'covered')`,
    [eventId, vendorProfileId],
  );
  await db.query(
    `INSERT INTO public.event_vendors
       (event_id, category, vendor_name, status, marketplace_vendor_id, linked_vendor_profile_id)
     VALUES ($1, 'photographer', 'Same Person Studio', 'contracted', $2, $2)`,
    [eventId, vendorProfileId],
  );

  const rows = await readBookingRows(eventId, userId);
  assert.equal(rows.length, 2, 'the supplier holds two rows on this event');
  const committed = rows.filter((r) =>
    (COMMITTED_BOOKING_STATUSES as readonly string[]).includes(r.status),
  );
  assert.equal(committed.length, 1, 'exactly one of the two rows is a real booking');
  assert.equal(
    committed[0]!.linked_vendor_profile_id,
    vendorProfileId,
    'the committed row must be the one the gate resolves',
  );
});

test('NOT PRESENT: the columns the supplier read selects cannot carry a guest name', async () => {
  const { userId, vendorProfileId } = await newVendorAccount(
    'leak@supplier.test',
    'Leak Check Co',
  );
  const eventId = await newPrivateEventWithGuests('leak-check-private');
  await db.query(
    `INSERT INTO public.event_vendors
       (event_id, category, vendor_name, status, marketplace_vendor_id, linked_vendor_profile_id)
     VALUES ($1, 'catering', 'Leak Check Co', 'contracted', $2, $2)`,
    [eventId, vendorProfileId],
  );

  // The guests really are there — otherwise this test proves nothing.
  const g = await db.query<{ n: string }>(
    `SELECT count(*)::text AS n FROM public.guests WHERE event_id = $1`,
    [eventId],
  );
  assert.equal(g.rows[0]!.n, '3', 'the event must be seeded WITH guests');

  const rows = await readBookingRows(eventId, userId);
  const serialized = JSON.stringify(rows);
  for (const guest of ['Maria Santos', 'Jose Rizal', 'Andres Bonifacio']) {
    assert.equal(
      serialized.includes(guest),
      false,
      `the supplier's booking read returned the guest name ${guest}`,
    );
  }
});

test('a supplier booked on ANOTHER event resolves to nothing here', async () => {
  const { userId, vendorProfileId } = await newVendorAccount(
    'elsewhere@supplier.test',
    'Elsewhere Studio',
  );
  const theirEvent = await newPrivateEventWithGuests('their-event-private');
  const otherEvent = await newPrivateEventWithGuests('someone-elses-private');
  await db.query(
    `INSERT INTO public.event_vendors
       (event_id, category, vendor_name, status, marketplace_vendor_id, linked_vendor_profile_id)
     VALUES ($1, 'photographer', 'Elsewhere Studio', 'contracted', $2, $2)`,
    [theirEvent, vendorProfileId],
  );

  assert.equal(
    (await readBookingRows(otherEvent, userId)).length,
    0,
    'a booking on one wedding must not open a different couple’s private page',
  );
});
