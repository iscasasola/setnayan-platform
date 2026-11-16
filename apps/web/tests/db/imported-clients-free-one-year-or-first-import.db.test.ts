/**
 * IMPORTED CLIENTS — owner 2026-11-16, specs DECISION_LOG d4899cd5, amended by 9fe95ebe. SUPERSEDES "AN IMPORTED
 * CLIENT BOOKS FREE FOR LIFE".
 *
 *   (1) the import created the client's account → no booking fee for 12 months from the import, on every booking that
 *       client makes with that supplier;
 *   (2) the client already had an account → free FOR THAT EVENT when this supplier is the FIRST imported supplier on
 *       it, new event or one already on Setnayan (9fe95ebe);
 *   (3) every other supplier on that event pays the normal fee, even when imported too;
 *   (4) an earlier Setnayan contact with the supplier makes it a Setnayan booking.
 *
 * The fix is migration 20271350679653 (`booking_fee_attribution_for` + `booking_fee_import_at` ·
 * `booking_fee_is_first_import` · `booking_fee_import_created_account`). Every fixture sets its own timestamps, so the
 * order of facts is the test, not the order the statements happen to run in.
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

const DAY = 24 * 60 * 60 * 1000;
const ago = (days: number) => new Date(Date.now() - days * DAY).toISOString();

async function newUser(tag: string): Promise<string> {
  const r = await db.query<{ id: string }>(
    `INSERT INTO auth.users (email, raw_user_meta_data) VALUES ($1, jsonb_build_object('account_type','customer')) RETURNING id`,
    [`${tag}-${++n}@imports.test`],
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

async function newEvent(couple: string, createdAt: string): Promise<string> {
  const r = await db.query<{ event_id: string }>(
    `INSERT INTO public.events (display_name, event_type, created_at) VALUES ($1, 'birthday', $2) RETURNING event_id`,
    [`Imports ${++n}`, createdAt],
  );
  const eventId = r.rows[0]!.event_id;
  await db.query(`INSERT INTO public.event_members (event_id, user_id, member_type) VALUES ($1, $2, 'couple')`, [eventId, couple]);
  return eventId;
}

async function row(eventId: string, shop: string, source: string, at: string): Promise<void> {
  await db.query(
    `INSERT INTO public.event_vendors (event_id, marketplace_vendor_id, category, vendor_name, status, source, created_at)
     VALUES ($1, $2, 'catering', 'Kusina', 'considering', $3, $4)`,
    [eventId, shop, source, at],
  );
}

async function view(eventId: string, shop: string, at: string): Promise<void> {
  await db.query(
    `INSERT INTO public.vendor_profile_views (vendor_profile_id, event_id, source, viewed_at) VALUES ($1, $2, 'search', $3)`,
    [shop, eventId, at],
  );
}

async function fee(shop: string, eventId: string): Promise<string> {
  const r = await db.query<{ a: string }>(`SELECT public.booking_fee_attribution_for($1, $2) AS a`, [shop, eventId]);
  return r.rows[0]!.a;
}

test('(1) the import brought the client onto Setnayan → free with that supplier on every event for 12 months', async () => {
  const shop = await newShop();
  const other = await newShop();
  const couple = await newUser('new-client');
  const first = await newEvent(couple, ago(60)); // the client's first event, made through the invite
  await row(first, shop, 'vendor_invite', ago(60 - 0.01));
  assert.equal(await fee(shop, first), 'import', 'the event the import brought');

  // A later celebration: the couple finds the same shop on Setnayan this time. Still inside the 12 months.
  const later = await newEvent(couple, ago(20));
  await row(later, shop, 'host_marketplace_search', ago(19));
  assert.equal(await fee(shop, later), 'import', 'every booking with THAT supplier is free for a year');
  // Another shop on that later event is not covered by somebody else's import.
  await row(later, other, 'host_marketplace_search', ago(18));
  assert.equal(await fee(other, later), 'sourced');
});

test('(1) after 12 months the year is over: a later Setnayan booking with the same supplier pays', async () => {
  const shop = await newShop();
  const couple = await newUser('old-client');
  const first = await newEvent(couple, ago(400));
  await row(first, shop, 'vendor_invite', ago(400 - 0.01));
  const later = await newEvent(couple, ago(10));
  await row(later, shop, 'host_marketplace_search', ago(9));
  assert.equal(await fee(shop, later), 'sourced', 'past the year, a Find save pays the fee');
  // The original event keeps (2): that supplier was its first import.
  assert.equal(await fee(shop, first), 'import');
});

test('(2)+(3) amendment 9fe95ebe — an existing event with two Setnayan-found suppliers + one import: the import is free, the two pay; a second import pays', async () => {
  const found1 = await newShop();
  const found2 = await newShop();
  const imported = await newShop();
  const secondImport = await newShop();
  const couple = await newUser('existing');
  await newEvent(couple, ago(300)); // the client was already on Setnayan
  const eventId = await newEvent(couple, ago(90));
  await row(eventId, found1, 'host_marketplace_search', ago(80));
  await row(eventId, found2, 'host_marketplace_search', ago(70));
  await row(eventId, imported, 'vendor_locked_qr', ago(60));
  await row(eventId, secondImport, 'vendor_invite', ago(50));

  assert.equal(await fee(imported, eventId), 'import', 'the first imported supplier on the event is free');
  assert.equal(await fee(found1, eventId), 'sourced');
  assert.equal(await fee(found2, eventId), 'sourced');
  assert.equal(await fee(secondImport, eventId), 'sourced', 'a second import on the same event pays');
});

test('(2) an existing account: the first import is free for THAT event only — the next event pays unless it is first again', async () => {
  const shop = await newShop();
  const couple = await newUser('existing');
  await newEvent(couple, ago(300));
  const a = await newEvent(couple, ago(100));
  await row(a, shop, 'vendor_invite', ago(99));
  assert.equal(await fee(shop, a), 'import');
  // Imported first onto another event, it is free there again ("always first, always free").
  const c = await newEvent(couple, ago(50));
  await row(c, shop, 'reuse_accept', ago(49));
  assert.equal(await fee(shop, c), 'import');
  // Not a new account, so no year: the same supplier found on Setnayan for the next event pays.
  const b = await newEvent(couple, ago(30));
  await row(b, shop, 'host_marketplace_search', ago(29));
  assert.equal(await fee(shop, b), 'sourced');
  // …and once Setnayan has introduced them, a later import is a Setnayan booking too (4, and LOCKED §3 every repeat).
  const d = await newEvent(couple, ago(10));
  await row(d, shop, 'vendor_invite', ago(9));
  assert.equal(await fee(shop, d), 'sourced');
});

test('(4) Setnayan showed the couple the shop before the import → a Setnayan booking, even as the first import', async () => {
  const shop = await newShop();
  const couple = await newUser('found-first');
  const eventId = await newEvent(couple, ago(40));
  await view(eventId, shop, ago(39));
  await row(eventId, shop, 'vendor_invite', ago(38));
  assert.equal(await fee(shop, eventId), 'sourced');
});

test('(4) a view AFTER the import does not take the free booking back', async () => {
  const shop = await newShop();
  const couple = await newUser('viewed-later');
  await newEvent(couple, ago(300));
  const eventId = await newEvent(couple, ago(40));
  await row(eventId, shop, 'vendor_invite', ago(38));
  await view(eventId, shop, ago(30));
  assert.equal(await fee(shop, eventId), 'import');
});

test('a booking with nothing from Setnayan and nothing imported still carries no fee (unchanged)', async () => {
  const shop = await newShop();
  const couple = await newUser('outside');
  const eventId = await newEvent(couple, ago(20));
  await row(eventId, shop, 'host_manual', ago(19));
  assert.equal(await fee(shop, eventId), 'import');
});
