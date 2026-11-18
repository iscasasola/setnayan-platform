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
 * Also the later rulings of the same day: 34909f12 + 99b6ab50 (waivers only for a VERIFIED shop, and only for imports
 * made after verification; an unverified shop always pays) · 993cdb9 (a cancelled first supplier still uses the free
 * slot) · 1abf35b (the Shortlist QR is an import QR; a couple's own Find invite is free only when it created the shop).
 *
 * The fix is migrations 20271352882666 + 20271352968519 (`booking_fee_attribution_for` + `booking_fee_import_at` ·
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

/** A shop. Verified ~3 years ago by default, so every import in these fixtures lands after verification. */
async function newShop(verified: 'verified' | 'unverified' = 'verified', since = ago(1000)): Promise<string> {
  const owner = await newUser('shop');
  const r = await db.query<{ vendor_profile_id: string }>(
    `INSERT INTO public.vendor_profiles
       (user_id, business_name, location_city, services, verification_state, last_verified_at, public_visibility, created_at)
     VALUES ($1, $2, 'Manila', ARRAY['catering']::text[], $3, $4, 'verified', $5)
     RETURNING vendor_profile_id`,
    [owner, `Kusina ${n}`, verified, verified === 'verified' ? since : null, since],
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

test('owner answer 3 (16 Nov) — a booking with nothing from Setnayan and nothing imported now pays (the coordinator loophole)', async () => {
  const shop = await newShop();
  const couple = await newUser('outside');
  const eventId = await newEvent(couple, ago(20));
  await row(eventId, shop, 'host_manual', ago(19));
  assert.equal(await fee(shop, eventId), 'sourced', 'a couple typing in a verified shop a coordinator named pays');
});

/* ── the later rulings of 16 Nov ── */

test('99b6ab50 — an unverified shop pays on everything; once verified, its next first-import event is free', async () => {
  const shop = await newShop('unverified');
  const couple = await newUser('new-client');
  const first = await newEvent(couple, ago(30));
  await row(first, shop, 'vendor_locked_qr', ago(30 - 0.01));
  assert.equal(await fee(shop, first), 'sourced', 'a QR import of a new couple by an unverified shop pays the flat 5%');
  const outside = await newEvent(await newUser('outside'), ago(25));
  await row(outside, shop, 'host_manual', ago(24));
  assert.equal(await fee(shop, outside), 'sourced', 'a booking with nothing imported pays');

  // The shop is verified now (today); imports from here on qualify, the one made before does not.
  await db.query(`UPDATE public.vendor_profiles SET verification_state = 'verified', last_verified_at = $2 WHERE vendor_profile_id = $1`, [shop, ago(5)]);
  assert.equal(await fee(shop, first), 'sourced', 'the import made before verification keeps paying');
  const next = await newEvent(await newUser('existing'), ago(3));
  await row(next, shop, 'vendor_invite', ago(2));
  assert.equal(await fee(shop, next), 'import', 'the next first-import event after verification is free');
});

test('993cdb9 (2) — the first imported supplier cancels: the slot is used up, the next import on that event pays', async () => {
  const first = await newShop();
  const next = await newShop();
  const couple = await newUser('existing');
  await newEvent(couple, ago(300));
  const eventId = await newEvent(couple, ago(40));
  await row(eventId, first, 'vendor_invite', ago(39));
  assert.equal(await fee(first, eventId), 'import');
  // Removing a supplier deletes its row (vendors/actions.ts) — the slot must outlive it.
  await db.query(`DELETE FROM public.event_vendors WHERE event_id = $1 AND marketplace_vendor_id = $2`, [eventId, first]);
  await row(eventId, next, 'vendor_locked_qr', ago(20));
  assert.equal(await fee(next, eventId), 'sourced', 'no later supplier gets the cancelled one\'s free slot');
});

test('1abf35b (1) — the Shortlist QR is an import QR: the first shop through it is free, a second pays', async () => {
  const a = await newShop();
  const b = await newShop();
  const couple = await newUser('existing');
  await newEvent(couple, ago(300));
  const eventId = await newEvent(couple, ago(40));
  await row(eventId, a, 'vendor_shortlist_qr', ago(39));
  await row(eventId, b, 'vendor_shortlist_qr', ago(38));
  assert.equal(await fee(a, eventId), 'import');
  assert.equal(await fee(b, eventId), 'sourced');
});

async function coupleInvite(eventId: string, shop: string, sentAt: string): Promise<void> {
  const ev = await db.query<{ vendor_id: string }>(
    `INSERT INTO public.event_vendors (event_id, category, vendor_name, status, source, linked_vendor_profile_id, created_at)
     VALUES ($1, 'catering', 'Tita Baby', 'considering', 'host_manual', $2, $3) RETURNING vendor_id`,
    [eventId, shop, sentAt],
  );
  const by = (await db.query<{ user_id: string }>(`SELECT user_id FROM public.event_members WHERE event_id = $1 LIMIT 1`, [eventId])).rows[0]!.user_id;
  await db.query(
    `INSERT INTO public.vendor_invites
       (vendor_id, invited_by_user_id, email, business_name, claim_token, status, sent_at, expires_at, claimed_vendor_profile_id, claimed_at)
     VALUES ($1, $2, $3, 'Tita Baby', $4, 'claimed', $5, $5::timestamptz + INTERVAL '90 days', $6, NOW())`,
    [ev.rows[0]!.vendor_id, by, `tita-${++n}@imports.test`, `tok-${n}-xxxxxxxxxxxxxxxxxxxxxxxx`, sentAt, shop],
  );
}

test('1abf35b (2) — the couple\'s own Find invite: a shop it CREATED books free; an EXISTING shop pays', async () => {
  const couple = await newUser('inviter');
  await newEvent(couple, ago(300));
  const eventId = await newEvent(couple, ago(60));
  const brandNew = await newShop('verified', ago(10)); // created after the invite went out
  await coupleInvite(eventId, brandNew, ago(20));
  assert.equal(await fee(brandNew, eventId), 'import');
  const existing = await newShop(); // created ~3 years ago
  await coupleInvite(eventId, existing, ago(15));
  assert.equal(await fee(existing, eventId), 'sourced');
});

/* ── owner answer 1 (16 Nov): "the import created the account" reads the invite timestamp ── */

async function lockedQrToken(shop: string, eventId: string, issuedAt: string): Promise<void> {
  const by = (await db.query<{ user_id: string }>(`SELECT user_id FROM public.vendor_profiles WHERE vendor_profile_id = $1`, [shop])).rows[0]!.user_id;
  await db.query(
    `INSERT INTO public.vendor_locked_qr_tokens (token, vendor_profile_id, created_by_user_id, category, status, claimed_event_id, created_at)
     VALUES ($1, $2, $3, 'catering', 'claimed', $4, $5)`,
    [`lqr-${++n}-xxxxxxxxxxxxxxxxxxxx`, shop, by, eventId, issuedAt],
  );
}

async function userMadeAt(at: string): Promise<string> {
  const id = await newUser('timed');
  await db.query(`UPDATE auth.users SET created_at = $2 WHERE id = $1`, [id, at]);
  return id;
}

test('Q1 — a Locked QR issued BEFORE the client had an account: the import made the account → the free year', async () => {
  const shop = await newShop();
  const couple = await userMadeAt(ago(59));
  const first = await newEvent(couple, ago(59));
  await lockedQrToken(shop, first, ago(61));
  await row(first, shop, 'vendor_locked_qr', ago(58));
  const later = await newEvent(couple, ago(20));
  await row(later, shop, 'host_marketplace_search', ago(19));
  assert.equal(await fee(shop, later), 'import', 'free with that supplier for a year');
});

test('Q1 — a Locked QR issued AFTER the client already had an account: an existing client, no free year', async () => {
  const shop = await newShop();
  const couple = await userMadeAt(ago(400)); // on Setnayan long before, never made an event
  const first = await newEvent(couple, ago(59));
  await lockedQrToken(shop, first, ago(60));
  await row(first, shop, 'vendor_locked_qr', ago(58));
  assert.equal(await fee(shop, first), 'import', 'still the first imported supplier on that event');
  const later = await newEvent(couple, ago(20));
  await row(later, shop, 'host_marketplace_search', ago(19));
  assert.equal(await fee(shop, later), 'sourced', 'no year: the account was older than the invite');
});

test('34909f1 / 1abf35b (1) — a chat through the shop\'s OWN LINK is an import: it takes the event\'s free slot, a later import pays', async () => {
  // Opus money review (2026-11-18): the own-link door had no test. `chat_threads_take_import_slot` must give the slot to
  // the own-link shop, and a supplier-brought row that lands later on the same event must find the slot taken.
  const own = await newShop();
  const later = await newShop();
  const couple = await newUser('existing');
  await newEvent(couple, ago(300));
  const eventId = await newEvent(couple, ago(40));
  await db.query(
    `INSERT INTO public.chat_threads (event_id, vendor_profile_id, inquiry_source, created_at) VALUES ($1, $2, 'website', $3)`,
    [eventId, own, ago(39)],
  );
  await row(eventId, own, 'host_manual', ago(38));
  const slot = await db.query<{ vendor_profile_id: string }>(
    `SELECT vendor_profile_id FROM public.booking_fee_event_import_slots WHERE event_id = $1`,
    [eventId],
  );
  assert.equal(slot.rows[0]?.vendor_profile_id, own, 'the own-link chat took the slot');
  assert.equal(await fee(own, eventId), 'import', 'the own-link shop is the event\'s free first import');
  await row(eventId, later, 'vendor_invite', ago(20));
  assert.equal(await fee(later, eventId), 'sourced', 'a later import on the same event pays');
});
