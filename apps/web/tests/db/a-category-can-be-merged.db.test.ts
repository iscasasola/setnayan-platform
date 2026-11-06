/**
 * A CATEGORY CAN BE MERGED — against a real replayed schema.
 *
 * The unit guard beside lib/tile-merge-holders.ts reads the migration's TEXT.
 * This one RUNS `merge_service_category()`: it seeds an event shaped like
 * cale-ice (couple suppliers filed under the source tile), a couple decision on
 * BOTH tiles (the UNIQUE collision), a bench pin and a trade, merges, and reads
 * back what every holder now says.
 *
 * 🔑 THE COMPLETENESS CHECK IS THE POINT. Every FK to service_categories, and
 * every column NAMED like a tile holder, must be either moved by the function
 * (TILE_KEY_HOLDERS) or ruled out with a reason (NOT_TILE_HOLDERS). A new
 * tile-keyed column that is in neither fails here — before a merge strands it.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import type { PGlite } from '@electric-sql/pglite';
import { createReplayedDb, type ReplayResult } from './replay-migrations';
import { TILE_KEY_HOLDERS, NOT_TILE_HOLDERS } from '../../lib/tile-merge-holders';

let replay: ReplayResult;
let db: PGlite;

const SRC = 'tst_merge_src_tile';
const DST = 'tst_merge_dst_tile';
const OTHER = 'tst_merge_other_tile';

before(async () => {
  replay = await createReplayedDb();
  db = replay.db;
});
after(async () => {
  await db?.close();
});

async function one<T>(sql: string, params: unknown[] = []): Promise<T> {
  return (await db.query<T>(sql, params)).rows[0]!;
}
async function count(sql: string, params: unknown[] = []): Promise<number> {
  return Number((await one<{ n: number }>(sql, params))?.n ?? 0);
}

async function seedTiles() {
  const folder = (await one<{ id: string }>(`SELECT id FROM service_categories WHERE tier=1 ORDER BY id LIMIT 1`)).id;
  for (const id of [SRC, DST, OTHER]) {
    await db.query(
      `INSERT INTO service_categories (id, parent_id, tier, kind, label_en, slug, sort_order)
       VALUES ($1, $2, 2, 'leaf', $1, replace($1,'_','-'), 999)
       ON CONFLICT (id) DO NOTHING`,
      [id, folder],
    );
  }
  return folder;
}

test('the migration added the merge function and the forward-on-write trigger', async () => {
  assert.equal(
    await count(`SELECT count(*)::int AS n FROM pg_proc WHERE proname='merge_service_category'`),
    1,
  );
  assert.equal(
    await count(`SELECT count(*)::int AS n FROM pg_trigger WHERE tgname='event_vendors_forward_merged_tile'`),
    1,
  );
});

test('every FK to service_categories, and every tile-named column, is registered', async () => {
  const known = new Set(
    [...TILE_KEY_HOLDERS, ...NOT_TILE_HOLDERS].map((h) => `${h.table}.${h.column}`),
  );
  const fks = (
    await db.query<{ col: string }>(
      `SELECT (c.conrelid::regclass)::text || '.' || a.attname AS col
         FROM pg_constraint c
         JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = ANY (c.conkey)
        WHERE c.contype = 'f' AND c.confrelid = 'public.service_categories'::regclass`,
    )
  ).rows.map((r) => r.col.replace(/^public\./, ''));
  assert.ok(fks.length >= 12, `premise: the FK sweep found ${fks.length} columns`);

  // Named like a tile holder. r2 keys and the photo-wall layout are not ids.
  const named = (
    await db.query<{ col: string }>(
      `SELECT c.table_name || '.' || c.column_name AS col
         FROM information_schema.columns c
         JOIN information_schema.tables t USING (table_schema, table_name)
        WHERE c.table_schema = 'public' AND t.table_type = 'BASE TABLE'
          AND (c.column_name ~ '(^|_)tiles?$' OR c.column_name ~ 'tile_id$'
               OR c.column_name IN ('category_key', 'category_id', 'team_first'))`,
    )
  ).rows.map((r) => r.col);

  const unregistered = [...new Set([...fks, ...named])].filter((c) => !known.has(c)).sort();
  assert.deepEqual(
    unregistered,
    [],
    `tile-keyed columns no list accounts for — add each to TILE_KEY_HOLDERS (and the SQL) or NOT_TILE_HOLDERS with a reason: ${unregistered.join(', ')}`,
  );
});

test('every registered holder column exists in the replayed schema', async () => {
  const missing: string[] = [];
  for (const h of TILE_KEY_HOLDERS) {
    const n = await count(
      `SELECT count(*)::int AS n FROM information_schema.columns
        WHERE table_schema='public' AND table_name=$1 AND column_name=$2`,
      [h.table, h.column],
    );
    if (n !== 1) missing.push(`${h.table}.${h.column}`);
  }
  assert.deepEqual(missing, []);
});

test('a category cannot be merged into itself, or into one that does not exist', async () => {
  await seedTiles();
  await assert.rejects(() => db.query(`SELECT merge_service_category($1,$1)`, [SRC]), /into itself/);
  await assert.rejects(
    () => db.query(`SELECT merge_service_category($1,$2)`, [SRC, 'no_such_tile_at_all']),
    /does not exist/,
  );
});

test('the merge moves the event holders — the cale-ice shape — collisions included', async () => {
  const folder = await seedTiles();

  const eventId = (
    await one<{ event_id: string }>(
      `INSERT INTO events (display_name, event_type) VALUES ('Merge fixture', 'birthday') RETURNING event_id`,
    )
  ).event_id;

  // Two couple suppliers filed under the source tile, one under an unrelated tile.
  const v1 = (
    await one<{ vendor_id: string }>(
      `INSERT INTO event_vendors (event_id, category, vendor_name, category_key)
       VALUES ($1, 'misc', 'Shoe shop', $2) RETURNING vendor_id`,
      [eventId, SRC],
    )
  ).vendor_id;
  await db.query(
    `INSERT INTO event_vendors (event_id, category, vendor_name, category_key)
     VALUES ($1, 'misc', 'Second shoe shop', $2), ($1, 'misc', 'Unrelated', $3)`,
    [eventId, SRC, OTHER],
  );

  // A decision on BOTH tiles for the same event — the partial UNIQUE collision.
  await db.query(
    `INSERT INTO event_category_decisions (event_id, tile, decision) VALUES ($1,$2,'excluded'), ($1,$3,'complete')`,
    [eventId, SRC, DST],
  );
  // A bench pin on the source rail.
  await db.query(
    `INSERT INTO event_bench_arrangement (event_id, tile, vendor_id, position) VALUES ($1,$2,$3,0)`,
    [eventId, SRC, v1],
  );
  // A trade living in the source tile, secondary on the destination.
  await db.query(
    `INSERT INTO canonical_service_taxonomy (canonical_service, folder_id, tile_id, phase, secondary_tiles)
     VALUES ('tst_merge_trade', $1, $2, 'planning', ARRAY[$3]::text[])
     ON CONFLICT (canonical_service) DO NOTHING`,
    [folder, SRC, DST],
  );
  // An event type that suggests both tiles, source first.
  await db.query(
    `UPDATE event_type_profiles SET team_first = ARRAY[$1,'x_keep',$2]::text[] WHERE event_type='wedding'`,
    [SRC, DST],
  );

  // Two inspiration parts that the fold turns into "home = also-from" (taxonomy v2 hit both
  // shapes: Fireworks → Lights on Cold sparks, AV → Lights on Dance-floor lighting).
  await db.query(
    `INSERT INTO inspiration_parts (slot_key, label_en, home_category_id)
     VALUES ('tst_cat_part_home_src', 'home on source', $1), ('tst_cat_part_home_dst', 'home on dest', $2)
     ON CONFLICT (slot_key) DO NOTHING`,
    [SRC, DST],
  );
  await db.query(
    `INSERT INTO inspiration_part_categories (slot_key, category_id, sort_order)
     VALUES ('tst_cat_part_home_src', $2, 1),
            ('tst_cat_part_home_dst', $1, 1), ('tst_cat_part_home_dst', $3, 2)`,
    [SRC, DST, OTHER],
  );

  const res = await one<{ r: { moved: Record<string, number> } }>(
    `SELECT merge_service_category($1,$2) AS r`,
    [SRC, DST],
  );
  const moved = res.r.moved;
  assert.equal(moved['event_vendors.category_key'], 2, 'both suppliers on the source tile moved');
  assert.equal(moved['event_category_decisions.tile'], 0, 'the colliding source decision was dropped, not moved');
  assert.equal(moved['event_bench_arrangement.tile'], 1);
  assert.equal(moved['canonical_service_taxonomy.tile_id'], 1);

  // ── nothing still names the source… ──
  for (const [t, c] of [
    ['event_vendors', 'category_key'],
    ['event_category_decisions', 'tile'],
    ['event_bench_arrangement', 'tile'],
    ['canonical_service_taxonomy', 'tile_id'],
  ] as const) {
    assert.equal(await count(`SELECT count(*)::int AS n FROM ${t} WHERE ${c}=$1`, [SRC]), 0, `${t}.${c}`);
  }
  // ── …and the rows ARRIVED. ──
  assert.equal(
    await count(`SELECT count(*)::int AS n FROM event_vendors WHERE event_id=$1 AND category_key=$2`, [eventId, DST]),
    2,
  );
  assert.equal(
    await count(`SELECT count(*)::int AS n FROM event_vendors WHERE event_id=$1 AND category_key=$2`, [eventId, OTHER]),
    1,
    'an unrelated supplier is left alone',
  );
  const decision = await one<{ decision: string }>(
    `SELECT decision FROM event_category_decisions WHERE event_id=$1 AND tile=$2`,
    [eventId, DST],
  );
  assert.equal(decision.decision, 'complete', 'the destination’s own decision wins the collision');

  const trade = await one<{ tile_id: string; folder_id: string; secondary_tiles: string[] }>(
    `SELECT tile_id, folder_id, secondary_tiles FROM canonical_service_taxonomy WHERE canonical_service='tst_merge_trade'`,
  );
  assert.equal(trade.tile_id, DST);
  assert.equal(trade.folder_id, folder);
  assert.deepEqual(trade.secondary_tiles, [], 'a trade is never secondary on its own tile');

  const team = await one<{ team_first: string[] }>(
    `SELECT team_first FROM event_type_profiles WHERE event_type='wedding'`,
  );
  assert.deepEqual(team.team_first, [DST, 'x_keep'], 'swapped in place, duplicate collapsed, order kept');

  // ── a part's "also from" never repeats its home after the fold ──
  const parts = await db.query<{ slot_key: string; home_category_id: string; also: string[] }>(
    `SELECT p.slot_key, p.home_category_id,
            ARRAY(SELECT c.category_id FROM inspiration_part_categories c
                   WHERE c.slot_key = p.slot_key ORDER BY c.sort_order, c.category_id) AS also
       FROM inspiration_parts p WHERE p.slot_key LIKE 'tst_cat_part_%' ORDER BY 1`,
  );
  // An also-from that folds onto the home is dropped; an unrelated one stays. (A part whose
  // HOME moves is re-derived from its services by the double-write trigger — so only "the home
  // is not repeated" is this function's claim there.)
  assert.deepEqual(
    parts.rows.map((r) => [r.slot_key, r.home_category_id, r.also.includes(r.home_category_id)]),
    [
      ['tst_cat_part_home_dst', DST, false],
      ['tst_cat_part_home_src', DST, false],
    ],
    'no part lists its home as an also-from after the fold',
  );
  assert.deepEqual(parts.rows[0]!.also, [OTHER], 'the unrelated also-from stayed');
  assert.ok((moved['inspiration_part_categories.collapsed_into_home'] ?? 0) >= 1, 'the collapse was counted');
});

test('the merged category is kept as a tombstone and refuses a second merge', async () => {
  const row = await one<{ merged_into_category_id: string; marketplace_hidden: boolean; status: string }>(
    `SELECT merged_into_category_id, marketplace_hidden, status FROM service_categories WHERE id=$1`,
    [SRC],
  );
  assert.equal(row.merged_into_category_id, DST);
  assert.equal(row.marketplace_hidden, true);
  assert.equal(row.status, 'retired');
  await assert.rejects(() => db.query(`SELECT merge_service_category($1,$2)`, [SRC, DST]), /already been merged/);
  await assert.rejects(() => db.query(`SELECT merge_service_category($1,$2)`, [OTHER, SRC]), /is not live/);
});

test('a writer that still names the merged tile lands on its replacement', async () => {
  const eventId = (await one<{ event_id: string }>(`SELECT event_id FROM events WHERE display_name='Merge fixture'`)).event_id;
  const v = await one<{ category_key: string }>(
    `INSERT INTO event_vendors (event_id, category, vendor_name, category_key)
     VALUES ($1, 'misc', 'Late writer', $2) RETURNING category_key`,
    [eventId, SRC],
  );
  assert.equal(v.category_key, DST);
});

test('merge_service_category is not executable by anon or authenticated', async () => {
  assert.equal(
    await count(
      `SELECT count(*)::int AS n FROM information_schema.routine_privileges
        WHERE routine_schema='public' AND routine_name='merge_service_category'
          AND grantee IN ('anon','authenticated','PUBLIC')`,
    ),
    0,
  );
});
