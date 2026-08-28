/**
 * A TRADE CAN BE MERGED — against a real replayed schema.
 *
 * The unit guard beside this one reads the migration's TEXT. This one RUNS it:
 * it seeds two shops (one holding BOTH trades, which is what makes every
 * UNIQUE collision fire), merges, and reads back what each holder now says.
 *
 * 🔑 WHY THE COLLISION SHOP IS THE WHOLE POINT. Six of the twelve holders sit
 * under a UNIQUE constraint that includes the trade key. A plain
 * `UPDATE … SET col = dest WHERE col = source` throws `23505` the moment one
 * owner holds both — the ORDINARY case for a merge. A test that seeds only a
 * shop holding the source passes without ever touching that path.
 *
 * ⚠ EVERY ASSERTION READS A VALUE BACK. `assert.rejects` would prove nothing
 * here: a row that was never moved and a row that was deleted look identical
 * from a count of the source key alone, so both sides are asserted.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import type { PGlite } from '@electric-sql/pglite';
import { createReplayedDb, type ReplayResult } from './replay-migrations';
import { CANONICAL_KEY_HOLDERS } from '../../lib/taxonomy-merge-holders';

let replay: ReplayResult;
let db: PGlite;

const SRC = 'sorbetes_cart';
const DST = 'ice_cream_cart';

before(async () => {
  replay = await createReplayedDb();
  db = replay.db;
});
after(async () => {
  await db?.close();
});

async function count(sql: string, params: unknown[] = []): Promise<number> {
  const r = await db.query<{ n: number }>(sql, params);
  return Number(r.rows[0]?.n ?? 0);
}

/** Both trades must exist in the replayed taxonomy for the merge to be legal. */
async function ensureTrades() {
  for (const k of [SRC, DST]) {
    await db.query(
      `INSERT INTO canonical_service_taxonomy (canonical_service, folder_id, phase)
       SELECT $1, (SELECT id FROM service_categories WHERE tier=1 LIMIT 1), 'planning'
       WHERE NOT EXISTS (SELECT 1 FROM canonical_service_taxonomy WHERE canonical_service=$1)`,
      [k],
    );
  }
}

test('the migration added the forwarding column and the merge function', async () => {
  const col = await count(
    `SELECT count(*)::int AS n FROM information_schema.columns
      WHERE table_schema='public' AND table_name='canonical_service_taxonomy'
        AND column_name='merged_into'`,
  );
  assert.equal(col, 1, 'canonical_service_taxonomy.merged_into must exist');

  const fn = await count(
    `SELECT count(*)::int AS n FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
      WHERE n.nspname='public' AND p.proname='merge_canonical_service'`,
  );
  assert.equal(fn, 1, 'merge_canonical_service must exist');
});

test('a trade cannot be merged into itself, or into a trade that does not exist', async () => {
  await ensureTrades();
  await assert.rejects(
    () => db.query(`SELECT merge_canonical_service($1,$1)`, [SRC]),
    /cannot be merged into itself/,
  );
  await assert.rejects(
    () => db.query(`SELECT merge_canonical_service($1,$2)`, [SRC, 'not_a_real_trade_at_all']),
    /does not exist/,
  );
});

test('the merge moves every shop-side holder, collisions included', async () => {
  await ensureTrades();

  // Shop A holds only the source. Shop B holds BOTH — the collision case.
  const a = (
    await db.query<{ vendor_profile_id: string }>(
      `INSERT INTO vendor_profiles (business_name, services)
       VALUES ('MERGE A', ARRAY[$1,'wedding_cake']::text[]) RETURNING vendor_profile_id`,
      [SRC],
    )
  ).rows[0]!.vendor_profile_id;
  const b = (
    await db.query<{ vendor_profile_id: string }>(
      `INSERT INTO vendor_profiles (business_name, services)
       VALUES ('MERGE B', ARRAY[$1,$2]::text[]) RETURNING vendor_profile_id`,
      [SRC, DST],
    )
  ).rows[0]!.vendor_profile_id;

  await db.query(
    `INSERT INTO vendor_coverages (vendor_profile_id, canonical_service)
     VALUES ($1,$3), ($2,$3), ($2,$4)`,
    [a, b, SRC, DST],
  );
  await db.query(`INSERT INTO vendor_services (vendor_profile_id, category, starting_price_php, exclusive_perk_text)
     VALUES ($1,$2,40000,'Free extra hour'),($3,$2,40000,'Free extra hour')`, [
    a,
    SRC,
    b,
  ]);

  // ── BEFORE ──
  assert.equal(
    await count(`SELECT count(*)::int AS n FROM vendor_coverages WHERE canonical_service=$1`, [SRC]),
    2,
  );
  assert.equal(
    await count(`SELECT count(*)::int AS n FROM vendor_services WHERE category=$1`, [SRC]),
    2,
  );

  await db.query(`SELECT merge_canonical_service($1,$2)`, [SRC, DST]);

  // ── AFTER: nothing still holds the old key… ──
  assert.equal(
    await count(`SELECT count(*)::int AS n FROM vendor_coverages WHERE canonical_service=$1`, [SRC]),
    0,
    'no coverage row may still name the merged-away trade',
  );
  assert.equal(
    await count(`SELECT count(*)::int AS n FROM vendor_services WHERE category=$1`, [SRC]),
    0,
    'no service card may still name the merged-away trade',
  );

  // ── …and the rows ARRIVED rather than being quietly destroyed. ──
  assert.equal(
    await count(`SELECT count(*)::int AS n FROM vendor_coverages WHERE canonical_service=$1`, [DST]),
    2,
    'shop A moved; shop B kept exactly one (its duplicate was collapsed, not doubled)',
  );
  assert.equal(
    await count(`SELECT count(*)::int AS n FROM vendor_services WHERE category=$1`, [DST]),
    2,
    'both cards moved',
  );

  // ── The TEXT[] holder: swapped AND de-duplicated. ──
  const bServices = (
    await db.query<{ services: string[] }>(
      `SELECT services FROM vendor_profiles WHERE vendor_profile_id=$1`,
      [b],
    )
  ).rows[0]!.services;
  assert.deepEqual(bServices, [DST], 'a shop that listed both must end up holding one, not two');

  const aServices = (
    await db.query<{ services: string[] }>(
      `SELECT services FROM vendor_profiles WHERE vendor_profile_id=$1`,
      [a],
    )
  ).rows[0]!.services;
  assert.ok(aServices.includes(DST), 'the source was swapped for the destination');
  assert.ok(!aServices.includes(SRC), 'the old key is gone');
  assert.ok(aServices.includes('wedding_cake'), 'an unrelated trade must be left alone');
});

test('the merged trade is kept as a tombstone, so the old key still resolves', async () => {
  const row = (
    await db.query<{ merged_into: string | null; marketplace_hidden: boolean }>(
      `SELECT merged_into, marketplace_hidden FROM canonical_service_taxonomy WHERE canonical_service=$1`,
      [SRC],
    )
  ).rows[0];
  assert.ok(row, 'the merged trade row must still EXIST — the forward dies with it');
  assert.equal(row!.merged_into, DST, 'it must point at its replacement');
  assert.equal(row!.marketplace_hidden, true, 'and it must leave every picker');
});

test('merging an already-merged trade is refused rather than chaining', async () => {
  await assert.rejects(
    () => db.query(`SELECT merge_canonical_service($1,$2)`, [SRC, DST]),
    /already been merged/,
  );
});

test('every registered holder column exists in the replayed schema', async () => {
  // Catches a registry row naming a column that does not exist — which would
  // make the merge silently skip it forever.
  const missing: string[] = [];
  for (const h of CANONICAL_KEY_HOLDERS) {
    const n = await count(
      `SELECT count(*)::int AS n FROM information_schema.columns
        WHERE table_schema='public' AND table_name=$1 AND column_name=$2`,
      [h.table, h.column],
    );
    if (n !== 1) missing.push(`${h.table}.${h.column}`);
  }
  assert.deepEqual(missing, [], `registry names columns that do not exist: ${missing.join(', ')}`);
});

test('merge_canonical_service is not executable by anon or authenticated', async () => {
  const anon = await count(
    `SELECT count(*)::int AS n FROM information_schema.routine_privileges
      WHERE routine_schema='public' AND routine_name='merge_canonical_service'
        AND grantee IN ('anon','authenticated','PUBLIC')`,
  );
  assert.equal(anon, 0, 'a signed-in stranger must not be able to merge trades');
});
