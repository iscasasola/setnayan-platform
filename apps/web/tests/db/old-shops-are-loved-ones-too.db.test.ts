/**
 * OLD SHOPS ARE LOVED ONES TOO — migration 20271283792997, run against the
 * REPLAYED schema.
 *
 * Since #6779 every door that makes an account own or name a shop calls
 * `ensureBusinessAlaga`, so a NEW shop gets its business alaga. A shop already
 * owned and named before that never passes a door again; owner 2026-10-22 ("A")
 * ruled those get theirs too. This migration is that backfill — the generic
 * rule, not a list of ids — and this file proves it writes what the helper
 * writes, where the helper would write it, and nowhere else.
 *
 *   1 · gate closed (`dependent_minor_profiles` not active) → nothing at all;
 *   2 · an owned, named shop with no record → exactly ONE, field-for-field the
 *       row `buildBusinessAlagaInsert` builds (trimmed, capped at 128, no
 *       birth date / sex / religion / relationship / consent stamp);
 *   3 · a shop that already has its record → that row untouched (not renamed,
 *       not duplicated);
 *   4 · a nameless or whitespace-named shop, an ownerless stub, and a deleted
 *       owner's shop → none;
 *   5 · run twice → the table is byte-for-byte the same.
 *
 * 🛡 Sabotaged, each red then restored (2026-10-22):
 *   • the `NOT EXISTS` and the `ON CONFLICT` both removed       → tests 3 + 5 red;
 *   • the blank-name filter removed                             → test 4 red;
 *   • the `deleted_at IS NULL` join condition removed           → test 4 red;
 *   • the gate `EXISTS (… status = 'active')` removed            → test 1 red;
 *   • the name written untrimmed                                 → test 2 red.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';

import { createReplayedDb, MIGRATIONS_DIR, type ReplayResult } from './replay-migrations';
import { buildBusinessAlagaInsert } from '../../lib/business-alaga';

let replay: ReplayResult;
let db: ReplayResult['db'];

const FILE = readdirSync(MIGRATIONS_DIR).find((f) => f.endsWith('_old_shops_get_their_business_alaga.sql'));
assert.ok(FILE, 'the backfill migration is missing');
const SQL = readFileSync(path.join(MIGRATIONS_DIR, FILE), 'utf8');

const LONG = `  ${'Kusina ni Lola '.repeat(12)}  `;

type Shop = { owner: string | null; shop: string; typed: string | null };
const shops: Record<string, Shop> = {};
let HAS_ONE_ID = '';

let n = 0;
async function account(): Promise<string> {
  n += 1;
  const u = await db.query<{ id: string }>(
    `INSERT INTO auth.users (email, raw_user_meta_data) VALUES ($1, jsonb_build_object('account_type','customer')) RETURNING id`,
    [`owner-${n}@old-shops.test`],
  );
  return u.rows[0]!.id;
}
async function shop(key: string, name: string | null, opts: { owned?: boolean } = {}): Promise<void> {
  const owner = opts.owned === false ? null : await account();
  const r = await db.query<{ v: string }>(
    `INSERT INTO public.vendor_profiles (user_id, business_name, location_city, services, verification_state, last_verified_at)
     VALUES ($1, $2, 'Manila', ARRAY['catering']::text[], 'verified', NOW()) RETURNING vendor_profile_id AS v`,
    [owner, name],
  );
  shops[key] = { owner, shop: r.rows[0]!.v, typed: name };
}
async function gate(status: 'active' | 'inactive'): Promise<void> {
  const r = await db.query(`UPDATE public.data_privacy_controls SET status = $1 WHERE control_key = 'dependent_minor_profiles'`, [status]);
  assert.equal(r.affectedRows, 1, 'the dependent_minor_profiles control is not seeded — the gate cannot be staged');
}
async function recordsFor(key: string) {
  const s = shops[key]!;
  return (
    await db.query<{
      dependent_id: string; owner_user_id: string; vendor_profile_id: string; dependent_kind: string; name: string;
      birth_date: string | null; sex: string | null; religion: string | null; relationship: string | null;
      birth_date_consent_at: string | null;
    }>(
      `SELECT dependent_id, owner_user_id, vendor_profile_id, dependent_kind, name, birth_date::text AS birth_date,
              sex, religion, relationship, birth_date_consent_at::text AS birth_date_consent_at
         FROM public.dependents WHERE vendor_profile_id = $1`,
      [s.shop],
    )
  ).rows;
}
async function snapshot(): Promise<string> {
  const r = await db.query(`SELECT * FROM public.dependents ORDER BY dependent_id`);
  return JSON.stringify(r.rows);
}

before(async () => {
  replay = await createReplayedDb();
  db = replay.db;
  await gate('inactive');

  await shop('missing', '  Saysay Host and Band  ');
  await shop('long', LONG);
  await shop('hasOne', 'Kusina Reyes');
  await shop('emptyName', ''); // business_name is NOT NULL; a trigger-opened shop is ''
  await shop('blankName', '   \t ');
  await shop('ownerless', 'Stub Catering', { owned: false });
  await shop('deletedOwner', 'Gone Florals');
  await db.query(`UPDATE public.users SET deleted_at = now() WHERE user_id = $1`, [shops.deletedOwner!.owner]);

  // The record that already exists — under an OLDER name, so "untouched" is
  // distinguishable from "rewritten to the same value".
  const h = await db.query<{ dependent_id: string }>(
    `INSERT INTO public.dependents (owner_user_id, vendor_profile_id, dependent_kind, name)
     VALUES ($1, $2, 'business', 'Kusina Reyes (old name)') RETURNING dependent_id`,
    [shops.hasOne!.owner, shops.hasOne!.shop],
  );
  HAS_ONE_ID = h.rows[0]!.dependent_id;
});
after(async () => {
  await db?.close();
});

test('1 · gate closed — the backfill writes nothing at all', async () => {
  const before = await snapshot();
  await db.exec(SQL);
  assert.equal(await snapshot(), before, 'the backfill wrote a record while dependent_minor_profiles was not active');
  assert.equal((await recordsFor('missing')).length, 0);
});

test('2 · an owned, named shop with no record gets exactly the row the helper builds', async () => {
  await gate('active');
  await db.exec(SQL);
  for (const key of ['missing', 'long'] as const) {
    const s = shops[key]!;
    const rows = await recordsFor(key);
    assert.equal(rows.length, 1, `${key}: expected one business alaga, found ${rows.length}`);
    const want = buildBusinessAlagaInsert({ ownerUserId: s.owner, vendorProfileId: s.shop, shopName: s.typed });
    assert.ok(want, `${key}: the helper would write nothing — the fixture is wrong`);
    const got = rows[0]!;
    assert.deepEqual(
      { owner_user_id: got.owner_user_id, vendor_profile_id: got.vendor_profile_id, dependent_kind: got.dependent_kind, name: got.name },
      want,
      `${key}: the backfilled row differs from buildBusinessAlagaInsert`,
    );
    assert.deepEqual(
      [got.birth_date, got.sex, got.religion, got.relationship, got.birth_date_consent_at],
      [null, null, null, null, null],
      `${key}: a business alaga carried a person's field`,
    );
  }
  assert.equal((await recordsFor('long'))[0]!.name.length, 128, 'the name was not capped at ALAGA_NAME_MAX');
});

test('3 · a shop that already has its record is left exactly as it is', async () => {
  const rows = await recordsFor('hasOne');
  assert.equal(rows.length, 1, `expected the one existing record, found ${rows.length}`);
  assert.equal(rows[0]!.dependent_id, HAS_ONE_ID, 'the existing record was replaced');
  assert.equal(rows[0]!.name, 'Kusina Reyes (old name)', 'the backfill renamed an existing record');
});

test('4 · nameless, ownerless and deleted-owner shops get nothing', async () => {
  for (const key of ['emptyName', 'blankName', 'ownerless', 'deletedOwner'] as const) {
    assert.equal((await recordsFor(key)).length, 0, `${key}: a record was written`);
    const s = shops[key]!;
    if (s.owner) {
      const helper = buildBusinessAlagaInsert({ ownerUserId: s.owner, vendorProfileId: s.shop, shopName: s.typed });
      if (key !== 'deletedOwner') assert.equal(helper, null, `${key}: the helper would write one — the migration and the helper disagree`);
    }
  }
});

test('5 · running it again changes nothing', async () => {
  const once = await snapshot();
  await db.exec(SQL);
  assert.equal(await snapshot(), once, 'a second run changed the dependents table');
  const per = await db.query<{ c: number }>(
    `SELECT count(*)::int AS c FROM public.dependents WHERE vendor_profile_id IS NOT NULL GROUP BY owner_user_id, vendor_profile_id HAVING count(*) > 1`,
  );
  assert.equal(per.rows.length, 0, 'a shop has two business alaga for one owner');
});
