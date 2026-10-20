/**
 * AN ADDED SUPPLIER KEEPS THE ROW IT WAS ADDED FROM — the add's own insert, on
 * the replayed schema, under the couple's session (owner 2026-10-20: *"We want
 * them to be designated to their category"*).
 *
 * `attachManualVendorToCategory` (the insert behind `addManualSupplier`, the
 * walk's and the sheet's one save) now writes `category_key` — the row — when
 * the enum cannot name it. These are its statements, with the values the shared
 * check (`categoryKeyForAdd`) produces:
 *   1. "＋ Add your own" from Food Truck: the couple's insert is accepted, the
 *      key passes its foreign key, and read back the card's home is Food Truck;
 *   2. Food Truck and Mocktail (both stored `misc`) are TWO records, each read
 *      back under its own row — never one;
 *   3. from the top-level Everything else row the insert writes NO key — byte
 *      for byte what it always wrote;
 *   4. another couple's identical insert into this event is refused (RLS);
 *   5. their claim link snapshots the record's `category` — the same value
 *      #6712's move keeps it at — so a later claim files the shop alike.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import type { PGlite } from '@electric-sql/pglite';
import { createReplayedDb, setAuthUid, type ReplayResult } from './replay-migrations';
import { categoryKeyForAdd, categoryForTile, homeTileForRow } from '../../lib/shortlist-taxonomy';
import { planSupplierMove, type SupplierMovePlan } from '../../lib/move-supplier-category';
import { WEDDING_TILES_BY_PARENT } from '../../lib/taxonomy';

let replay: ReplayResult;
let db: PGlite;

before(async () => {
  replay = await createReplayedDb();
  db = replay.db;
});
after(async () => {
  await db?.close();
});

const DRAWN = new Set(Object.values(WEDDING_TILES_BY_PARENT).flat() as string[]);
const isTile = (t: string) => DRAWN.has(t);

let seq = 0;
const uniq = () => `addrow-${++seq}-${Date.now()}`;

async function reset() {
  await db.exec(`RESET ROLE`).catch(() => {});
  await setAuthUid(db, null);
  await db.query(`SELECT set_config('request.jwt.claim.role', '', false)`);
}
async function asUser(uid: string) {
  await reset();
  await setAuthUid(db, uid);
  await db.query(`SELECT set_config('request.jwt.claim.role', 'authenticated', false)`);
  await db.exec(`SET ROLE authenticated`);
}

async function newCouple(): Promise<{ couple: string; eventId: string }> {
  await reset();
  const u = await db.query<{ id: string }>(
    `INSERT INTO auth.users (email, raw_user_meta_data)
     VALUES ($1, jsonb_build_object('account_type','customer')) RETURNING id`,
    [`${uniq()}@test.local`],
  );
  const couple = u.rows[0]!.id;
  const e = await db.query<{ event_id: string }>(
    `INSERT INTO public.events (display_name, event_type, ceremony_type, venue_setting)
     VALUES ($1,'wedding','civil','garden') RETURNING event_id`,
    [`Wedding ${uniq()}`],
  );
  const eventId = e.rows[0]!.event_id;
  await db.query(`INSERT INTO public.event_members (event_id, user_id, member_type) VALUES ($1,$2,'couple')`, [
    eventId,
    couple,
  ]);
  return { couple, eventId };
}

/**
 * The add, statement for statement, as `uid`: the contact card, then the
 * attach's insert — `category` from the row the bench posted, `category_key`
 * from the shared check. Returns the new event_vendors id.
 */
async function addFrom(uid: string, eventId: string, tile: string, name: string): Promise<string> {
  const category = categoryForTile(tile as never);
  const categoryKey = categoryKeyForAdd(category, tile, isTile);
  await asUser(uid);
  const m = await db.query<{ manual_vendor_id: string }>(
    `INSERT INTO public.event_manual_vendors (event_id, business_name, contact_person, created_by_user_id)
     VALUES ($1, $2, 'Ate Joy', $3) RETURNING manual_vendor_id`,
    [eventId, name, uid],
  );
  const r = await db.query<{ vendor_id: string }>(
    `INSERT INTO public.event_vendors (event_id, category, category_key, vendor_name, manual_vendor_id, status, source)
     VALUES ($1, $2::public.vendor_category, $3, $4, $5, 'considering', 'host_manual') RETURNING vendor_id`,
    [eventId, category, categoryKey, name, m.rows[0]!.manual_vendor_id],
  );
  await reset();
  return r.rows[0]!.vendor_id;
}

async function rowOf(vendorId: string) {
  await reset();
  return (
    await db.query<{ category: string; category_key: string | null }>(
      `SELECT category::text AS category, category_key FROM public.event_vendors WHERE vendor_id = $1`,
      [vendorId],
    )
  ).rows[0]!;
}

test('1 · added from Food Truck: accepted, the key passes its foreign key, read back under Food Truck', async () => {
  const { couple, eventId } = await newCouple();
  const v = await addFrom(couple, eventId, 'food_truck', "Dunkin' Donuts");
  const row = await rowOf(v);
  assert.deepEqual(row, { category: 'misc', category_key: 'food_truck' });
  assert.equal(homeTileForRow(row, isTile), 'food_truck', 'read back, the card is not under Food Truck');
});

test('2 · Food Truck and Mocktail share `misc` — two records, each under its own row', async () => {
  const { couple, eventId } = await newCouple();
  const truck = await addFrom(couple, eventId, 'food_truck', 'Kariton Express');
  const mock = await addFrom(couple, eventId, 'mocktail', 'Sip & Co');
  assert.notEqual(truck, mock);
  await reset();
  const rows = (
    await db.query<{ vendor_id: string; category: string; category_key: string | null }>(
      `SELECT vendor_id, category::text AS category, category_key FROM public.event_vendors WHERE event_id = $1 ORDER BY vendor_name`,
      [eventId],
    )
  ).rows;
  assert.equal(rows.length, 2, 'two adds made one record');
  const home = new Map(rows.map((r) => [r.vendor_id, homeTileForRow(r, isTile)]));
  assert.equal(home.get(truck), 'food_truck');
  assert.equal(home.get(mock), 'mocktail');
});

test('3 · from the top-level Everything else row: no key, as always', async () => {
  const { couple, eventId } = await newCouple();
  const v = await addFrom(couple, eventId, 'everything_else', 'Odds & Ends');
  assert.deepEqual(await rowOf(v), { category: 'misc', category_key: null });
});

test('4 · another couple’s identical add into this event is refused', async () => {
  const a = await newCouple();
  const b = await newCouple();
  await assert.rejects(addFrom(b.couple, a.eventId, 'food_truck', 'Intruder Truck'), /row-level security|violates/i);
  await reset();
  const n = await db.query(`SELECT 1 FROM public.event_vendors WHERE event_id = $1`, [a.eventId]);
  assert.equal(n.rows.length, 0);
});

test('5 · the claim link snapshots the record’s category — the value #6712’s move keeps it at', async () => {
  const { couple, eventId } = await newCouple();
  const v = await addFrom(couple, eventId, 'food_truck', "Dunkin' Donuts");
  // `createManualVendorInvite` → `ensureAutoShareInvite({ serviceCategory: row.category })`.
  const row = await rowOf(v);
  await reset();
  const inv = await db.query<{ service_category: string }>(
    `INSERT INTO public.vendor_invites (vendor_id, business_name, service_category, claim_token, source, status, expires_at)
     VALUES ($1, 'Dunkin'' Donuts', $2, $3, 'auto_share_link', 'pending', now() + interval '90 days') RETURNING service_category`,
    [v, row.category, `tok-${uniq()}`],
  );
  const p = planSupplierMove({ category: 'cake_maker', category_key: null, covers_plan_groups: [] }, 'food_truck');
  assert.ok(!('refused' in p));
  assert.equal(inv.rows[0]!.service_category, (p as SupplierMovePlan).category, 'an add and a move file the claim differently');
});
