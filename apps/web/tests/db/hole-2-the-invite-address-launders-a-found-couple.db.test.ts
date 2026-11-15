/**
 * HOLE 2 · THE PUBLIC INVITE ADDRESS LAUNDERS A COUPLE SETNAYAN ALREADY SHOWED THE SHOP — PROVEN OPEN
 * (controller sweep 2026-11-16).
 *
 * TESTS ONLY. Every assertion below PASSES WHILE THE HOLE IS OPEN. The fix PR
 * flips each `HOLE OPEN` assertion to its closed form and renames the file.
 *
 * `/vendor-invite/<shop-slug>` is public and tokenless (the shop's own slug).
 * `claimVendorInviteToEvent` (app/vendor-invite/[slug]/actions.ts) →
 * `importVendorToEventShortlist` (lib/vendor-couple-invite.ts) inserts, with the
 * service role, an `event_vendors` row with `source = 'vendor_invite'` — unless
 * the shop is ALREADY a marketplace row on the event. `vendor_invite` is in
 * `SUPPLIER_BROUGHT_SOURCES`, so `bookingFeeAttributionFromFacts` and its SQL
 * twin `booking_fee_attribution_for` answer 'import' (free forever) BEFORE they
 * look at any earlier Setnayan fact.
 *
 * So a couple who FOUND the shop on Setnayan (a profile view from Find — which
 * also writes `event_vendor_found`) and never pressed Save can be sent the
 * shop's invite link, and the booking is free. A save from any other door with
 * the very same history is billable.
 *
 * Second half: the owner ruled only the FIRST importer is free. A SECOND shop's
 * invite link on a couple another shop already brought is ALSO 'import' today.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import type { PGlite } from '@electric-sql/pglite';

import { bookingFeeAttributionFromFacts } from '../../lib/booking-fee-gate';
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
    [`${tag}-${++n}@hole-2.test`],
  );
  return r.rows[0]!.id;
}

async function newShop(): Promise<string> {
  const owner = await newUser('shop');
  const r = await db.query<{ vendor_profile_id: string }>(
    `INSERT INTO public.vendor_profiles
       (user_id, business_name, business_slug, location_city, services, verification_state, last_verified_at, public_visibility)
     VALUES ($1, $2, $3, 'Manila', ARRAY['catering']::text[], 'verified', NOW(), 'verified')
     RETURNING vendor_profile_id`,
    [owner, `Kusina ${n}`, `kusina-hole-2-${n}`],
  );
  return r.rows[0]!.vendor_profile_id;
}

async function newCoupleEvent(): Promise<string> {
  const couple = await newUser('couple');
  const r = await db.query<{ event_id: string }>(
    `INSERT INTO public.events (display_name, event_type) VALUES ($1, 'birthday') RETURNING event_id`,
    [`Hole 2 ${++n}`],
  );
  const eventId = r.rows[0]!.event_id;
  await db.query(`INSERT INTO public.event_members (event_id, user_id, member_type) VALUES ($1, $2, 'couple')`, [
    eventId,
    couple,
  ]);
  return eventId;
}

/** The couple opens the shop from Find (`FIND_SHEET_VIEW_SOURCE` = 'search') — the view row the app already writes. */
async function foundOnSetnayan(shop: string, eventId: string, at: string): Promise<void> {
  await db.query(
    `INSERT INTO public.vendor_profile_views (vendor_profile_id, event_id, source, viewed_at) VALUES ($1, $2, 'search', $3)`,
    [shop, eventId, at],
  );
}

/** Exactly the row `importVendorToEventShortlist` inserts (service role) when the couple opens /vendor-invite/<slug>. */
async function importedByInviteLink(shop: string, eventId: string, at: string): Promise<void> {
  await db.query(
    `INSERT INTO public.event_vendors (event_id, marketplace_vendor_id, category, vendor_name, status, source, created_at)
     VALUES ($1, $2, 'catering', 'Kusina', 'considering', 'vendor_invite', $3)`,
    [eventId, shop, at],
  );
}

async function attribution(shop: string, eventId: string): Promise<string> {
  const r = await db.query<{ a: string }>(`SELECT public.booking_fee_attribution_for($1, $2) AS a`, [shop, eventId]);
  return r.rows[0]!.a;
}

const SEEN = '2026-11-01T10:00:00Z';
const LATER = '2026-11-03T10:00:00Z';
const LATEST = '2026-11-05T10:00:00Z';

test('control — the same history through any other door is billable (the hole is the door, not the facts)', async () => {
  const shop = await newShop();
  const eventId = await newCoupleEvent();
  await foundOnSetnayan(shop, eventId, SEEN);
  await db.query(
    `INSERT INTO public.event_vendors (event_id, marketplace_vendor_id, category, vendor_name, status, source, created_at)
     VALUES ($1, $2, 'catering', 'Kusina', 'considering', 'host_manual', $3)`,
    [eventId, shop, LATER],
  );
  assert.equal(await attribution(shop, eventId), 'sourced');
});

test('HOLE OPEN · 2a — a couple Setnayan showed the shop to, then sent the shop\'s invite link, is the shop\'s free import', async () => {
  const shop = await newShop();
  const eventId = await newCoupleEvent();
  await foundOnSetnayan(shop, eventId, SEEN);

  // Setnayan recorded the find, at the moment of seeing.
  const found = await db.query<{ first_found_at: string }>(
    `SELECT first_found_at FROM public.event_vendor_found WHERE event_id = $1 AND vendor_profile_id = $2`,
    [eventId, shop],
  );
  assert.equal(found.rows.length, 1, 'precondition: event_vendor_found holds the Setnayan find');

  await importedByInviteLink(shop, eventId, LATER);

  // HOLE OPEN: the invite row wins over the earlier find. Fix flips to: 'sourced'.
  assert.equal(await attribution(shop, eventId), 'import', 'booking_fee_attribution_for — the found couple became a free import');
  assert.equal(
    bookingFeeAttributionFromFacts({
      threadSources: [],
      rowSource: 'vendor_invite',
      rowIsManualRecord: false,
      recordTiedToShop: true,
      savesBefore: [],
      viewSourcesBefore: ['search'],
    }),
    'import',
    'bookingFeeAttributionFromFacts agrees — SUPPLIER_BROUGHT_SOURCES short-circuits before the view arm',
  );
});

test('HOLE OPEN · 2b — a SECOND shop\'s invite link on a couple another shop already brought is also free', async () => {
  const first = await newShop();
  const second = await newShop();
  const eventId = await newCoupleEvent();

  await importedByInviteLink(first, eventId, LATER);
  assert.equal(await attribution(first, eventId), 'import', 'the FIRST importer is free — the owner ruled this stays');

  await importedByInviteLink(second, eventId, LATEST);
  // HOLE OPEN: owner ruled only the FIRST importer is free. Fix flips to: 'sourced'.
  assert.equal(await attribution(second, eventId), 'import', 'the second importer is free too');
});
