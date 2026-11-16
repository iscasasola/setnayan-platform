/**
 * HOLE 2 · THE PUBLIC INVITE ADDRESS NO LONGER LAUNDERS A COUPLE SETNAYAN ALREADY SHOWED THE SHOP — CLOSED
 * (controller sweep 2026-11-16; the proof was #7841's `hole-2-the-invite-address-launders-a-found-couple.db.test.ts`,
 * every HOLE OPEN assertion flipped here to CLOSED).
 *
 * Closed on `main` by #7844 (`81d37c37`, owner 2026-11-16, specs DECISION_LOG "THE SHORTLIST QR STAYS FREE BUT IS
 * NOT AN IMPORT"): `/vendor-invite/<shop-slug>` → `claimVendorInviteToEvent` → `importVendorToEventShortlist` now
 * writes `source = 'vendor_shortlist_qr'` (`SHORTLIST_QR_SOURCE`), which is a SAVE ON SETNAYAN
 * (`SETNAYAN_SAVE_SOURCES`), never one of `SUPPLIER_BROUGHT_SOURCES`. So the public, tokenless address can no longer
 * turn a couple into a free import — whether Setnayan showed them the shop first (2a) or another shop got there
 * first (2b).
 *
 * 2b's target moved: #7841 expected "only the FIRST importer is free" (owner, earlier 16 Nov). The owner replaced that
 * rule the same day — specs DECISION_LOG "EVERY SUPPLIER IMPORT CARRIES AT LEAST ONE SETNAYAN GIFT — REPLACES 'ONLY
 * THE FIRST SUPPLIER IMPORTS FREE'". An own-client import is now one that carries a gift, and that door is not built;
 * the public address is the Shortlist QR, which is never free. So BOTH shops' rows read 'sourced'.
 *
 * Fixtures write exactly the row the importer writes (the constant it uses), and a source scan pins the importer to
 * that constant — so the fixture cannot drift from the app.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import type { PGlite } from '@electric-sql/pglite';

import { readFileSync } from 'node:fs';
import path from 'node:path';

import { bookingFeeAttributionFromFacts, SHORTLIST_QR_SOURCE, SUPPLIER_BROUGHT_SOURCES } from '../../lib/booking-fee-gate';
import { stripComments } from '../../lib/strip-comments';
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
     VALUES ($1, $2, 'catering', 'Kusina', 'considering', $4, $3)`,
    [eventId, shop, at, SHORTLIST_QR_SOURCE],
  );
}

const HERE = import.meta.dirname;
const importerBody = (): string => {
  const src = stripComments(readFileSync(path.join(HERE, '..', '..', 'lib', 'vendor-couple-invite.ts'), 'utf8'));
  const at = src.indexOf('export async function importVendorToEventShortlist');
  assert.ok(at >= 0, 'importVendorToEventShortlist is gone — re-read the hole before trusting this file');
  const end = src.indexOf('\nexport ', at + 10);
  return src.slice(at, end > at ? end : undefined);
};

test('CLOSED · the public invite address writes the Shortlist QR source, never a supplier-brought one', () => {
  const body = importerBody();
  assert.match(body, /source:\s*SHORTLIST_QR_SOURCE/, 'importVendorToEventShortlist stamps SHORTLIST_QR_SOURCE');
  for (const s of SUPPLIER_BROUGHT_SOURCES) {
    assert.ok(!body.includes(`'${s}'`), `importVendorToEventShortlist writes the supplier-brought source '${s}'`);
  }
  assert.ok(!SUPPLIER_BROUGHT_SOURCES.has(SHORTLIST_QR_SOURCE), 'the Shortlist QR source is not a supplier-brought source');
});

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

test('CLOSED · 2a — a couple Setnayan showed the shop to, then sent the shop\'s invite link, stays Setnayan-sourced', async () => {
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

  // CLOSED (was HOLE OPEN 'import'): the invite-address row is a Setnayan save, so the earlier find stands.
  assert.equal(await attribution(shop, eventId), 'sourced', 'booking_fee_attribution_for — the found couple stays sourced');
  assert.equal(
    bookingFeeAttributionFromFacts({
      threadSources: [],
      rowSource: SHORTLIST_QR_SOURCE,
      rowIsManualRecord: false,
      recordTiedToShop: true,
      savesBefore: [],
      viewSourcesBefore: ['search'],
    }),
    'sourced',
    'bookingFeeAttributionFromFacts agrees — the Shortlist QR source is a Setnayan save',
  );
});

test('CLOSED · 2b — neither the first nor a second shop\'s invite link makes the couple a free import', async () => {
  const first = await newShop();
  const second = await newShop();
  const eventId = await newCoupleEvent();

  await importedByInviteLink(first, eventId, LATER);
  // The public address is the Shortlist QR, not an own-client import (an import now needs a gift — 16 Nov, unbuilt).
  assert.equal(await attribution(first, eventId), 'sourced', 'the first shop through the public address pays the fee');

  await importedByInviteLink(second, eventId, LATEST);
  // CLOSED (was HOLE OPEN 'import').
  assert.equal(await attribution(second, eventId), 'sourced', 'a second shop through the public address pays the fee');
});
