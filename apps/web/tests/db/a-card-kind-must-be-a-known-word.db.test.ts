/**
 * A CARD'S KIND MUST BE A KNOWN WORD (SUP-21 / SC-10), proved against the full
 * replayed schema.
 *
 * `vendor_services.category` is plain TEXT, and `save_vendor_service` validates
 * nothing, so `parseCategory()` in the services actions was the whole fence.
 * Migration 20271234232465 adds a BEFORE INSERT / UPDATE OF category trigger
 * that refuses a word in none of the four live vocabularies: the
 * `vendor_category` enum, `canonical_service_taxonomy`, `service_categories`,
 * and `canonical_service_schemas`.
 *
 * Not vacuous. Each "refused" case first confirms the word really is absent
 * from all four sources, so a fixture that happens to name a real kind cannot
 * read as a pass. Each "accepted" case confirms its word IS in the source it
 * stands for. The last test drops the trigger and requires the unknown word to
 * go through, so a trigger that never fires would fail here.
 */

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import type { PGlite } from '@electric-sql/pglite';
import { createReplayedDb, type ReplayResult } from './replay-migrations';

let replay: ReplayResult;
let db: PGlite;

const VP = '29292929-2929-4292-8292-292929292929';
const UNKNOWN = 'a_word_no_vocabulary_has';

before(async () => {
  replay = await createReplayedDb();
  db = replay.db;
  await db.query(
    `INSERT INTO vendor_profiles (vendor_profile_id, business_name, verification_state, last_verified_at)
     VALUES ($1, 'Kind Fence Test Shop', 'verified', NOW())
     ON CONFLICT (vendor_profile_id) DO NOTHING`,
    [VP],
  );
});
after(async () => {
  await db?.close();
});

async function inEnum(word: string): Promise<boolean> {
  const r = await db.query<{ n: number }>(
    `SELECT count(*)::int AS n FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid
      WHERE t.typname = 'vendor_category' AND e.enumlabel = $1`,
    [word],
  );
  return r.rows[0]!.n > 0;
}
async function inLeaves(word: string): Promise<boolean> {
  const r = await db.query<{ n: number }>(
    `SELECT count(*)::int AS n FROM canonical_service_taxonomy WHERE canonical_service = $1`,
    [word],
  );
  return r.rows[0]!.n > 0;
}
async function inTree(word: string): Promise<boolean> {
  const r = await db.query<{ n: number }>(`SELECT count(*)::int AS n FROM service_categories WHERE id = $1`, [word]);
  return r.rows[0]!.n > 0;
}

async function inSchemas(word: string): Promise<boolean> {
  const r = await db.query<{ n: number }>(
    `SELECT count(*)::int AS n FROM canonical_service_schemas WHERE canonical_service = $1`,
    [word],
  );
  return r.rows[0]!.n > 0;
}

async function insertCard(category: string): Promise<string> {
  const r = await db.query<{ vendor_service_id: string }>(
    `INSERT INTO vendor_services (vendor_profile_id, category, is_active)
     VALUES ($1, $2, false) RETURNING vendor_service_id`,
    [VP, category],
  );
  assert.equal(r.rows.length, 1, 'the insert returned no row, so the case proved nothing');
  return r.rows[0]!.vendor_service_id;
}

async function refusal(fn: () => Promise<unknown>): Promise<string | null> {
  try {
    await fn();
    return null;
  } catch (e) {
    return (e as Error).message;
  }
}

test('the fixture word really is in no vocabulary', async () => {
  assert.equal(await inEnum(UNKNOWN), false);
  assert.equal(await inLeaves(UNKNOWN), false);
  assert.equal(await inTree(UNKNOWN), false);
  assert.equal(await inSchemas(UNKNOWN), false);
});

test('each vocabulary is non-empty in the replay (a floor, so "accepted" cannot be vacuous)', async () => {
  const r = await db.query<{ e: number; l: number; t: number }>(
    `SELECT (SELECT count(*)::int FROM pg_enum en JOIN pg_type ty ON ty.oid = en.enumtypid WHERE ty.typname = 'vendor_category') AS e,
            (SELECT count(*)::int FROM canonical_service_taxonomy) AS l,
            (SELECT count(*)::int FROM service_categories) AS t`,
  );
  const { e, l, t } = r.rows[0]!;
  assert.ok(e >= 50, `vendor_category enum has ${e} values`);
  assert.ok(l >= 50, `canonical_service_taxonomy has ${l} rows`);
  assert.ok(t >= 20, `service_categories has ${t} rows`);
});

test('an INSERT with an unknown kind is refused, and the message names the word', async () => {
  const msg = await refusal(() => insertCard(UNKNOWN));
  assert.ok(msg, 'an unknown kind was stored');
  assert.match(msg!, /Unknown service kind/);
  assert.ok(msg!.includes(UNKNOWN), `the refusal does not name the word: ${msg}`);
});

test('a legacy enum key is accepted', async () => {
  assert.equal(await inEnum('photographer'), true);
  await insertCard('photographer');
});

test('a coverage leaf that is NOT an enum key is accepted', async () => {
  assert.equal(await inEnum('live_band'), false, 'pick a leaf outside the enum, or this proves nothing new');
  assert.equal(await inLeaves('live_band'), true);
  await insertCard('live_band');
});

test('host_mc (a live prod kind, only a tree node) is accepted', async () => {
  assert.equal(await inEnum('host_mc'), false);
  assert.equal(await inLeaves('host_mc'), false);
  assert.equal(await inTree('host_mc'), true);
  await insertCard('host_mc');
});

test('a leaf an admin adds later is accepted with no migration (the list is read live)', async () => {
  const fresh = 'a_leaf_added_by_an_admin_today';
  assert.equal(await refusal(() => insertCard(fresh)) !== null, true, 'refused before the leaf exists');
  // Clone live_band's placement so every NOT NULL column is honestly filled.
  const added = await db.query(
    `INSERT INTO canonical_service_taxonomy
     SELECT (jsonb_populate_record(t, jsonb_build_object('canonical_service', $1::text))).*
       FROM canonical_service_taxonomy t WHERE t.canonical_service = 'live_band'
     RETURNING canonical_service`,
    [fresh],
  );
  assert.equal(added.rows.length, 1, 'the admin-added leaf was not created');
  await insertCard(fresh);
});

test('changing a card to an unknown kind is refused', async () => {
  const id = await insertCard('photographer');
  const msg = await refusal(() =>
    db.query(`UPDATE vendor_services SET category = $2 WHERE vendor_service_id = $1`, [id, UNKNOWN]),
  );
  assert.ok(msg, 'an UPDATE moved a card to an unknown kind');
  assert.match(msg!, /Unknown service kind/);
});

test('a row written before the fence can still have its price edited', async () => {
  await db.query('ALTER TABLE vendor_services DISABLE TRIGGER trg_before_vendor_services_kind_is_known');
  let id: string;
  try {
    id = await insertCard(UNKNOWN);
  } finally {
    await db.query('ALTER TABLE vendor_services ENABLE TRIGGER trg_before_vendor_services_kind_is_known');
  }
  const r = await db.query<{ starting_price_php: number }>(
    `UPDATE vendor_services SET starting_price_php = 12345 WHERE vendor_service_id = $1 RETURNING starting_price_php`,
    [id],
  );
  assert.equal(r.rows.length, 1, 'the edit touched no row');
  assert.equal(r.rows[0]!.starting_price_php, 12345);
});

test('SABOTAGE: with the trigger dropped, the unknown kind goes through (so the refusal above is the trigger)', async () => {
  await db.query('BEGIN');
  try {
    await db.query('DROP TRIGGER trg_before_vendor_services_kind_is_known ON vendor_services');
    const id = await insertCard(UNKNOWN);
    assert.ok(id);
  } finally {
    await db.query('ROLLBACK');
  }
  const msg = await refusal(() => insertCard(UNKNOWN));
  assert.ok(msg, 'the rollback did not restore the trigger');
});
