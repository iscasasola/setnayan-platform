/**
 * ONE SOURCE · BUCKETS — "which services are under this category / group" is answered by the
 * database, and stays answered by it after an admin edits the database (test:db, migrations
 * replayed).
 *
 * ③0-a of the taxonomy build (corpus `prototypes/admin_taxonomy_four_levels_2026-10-26/PLAN.md`
 * § 8.3; owner 2026-10-26 "make sure everything follows. this is the foundation of all
 * suppliers").
 *
 * ── WHY THIS IS NOT ANOTHER SEED-COMPARISON GUARD ─────────────────────────────────────────────
 * Every older taxonomy guard compares code to the migration-replayed seed. Each is green until the
 * first real admin edit and then says nothing, because on the seed the const and the table agree
 * by construction. So this file asserts two different things:
 *
 *   1. ON TODAY'S DATA the reader changes nothing: the buckets `getCanonicalBuckets()` derives from
 *      the replayed tables equal the buckets the deleted module-load constants produced (the old
 *      algorithm, frozen below as the proof), tile by tile and group by group;
 *   2. AFTER A SIMULATED ADMIN EDIT (add a category, add a service, move one, cross-list one, hide
 *      one) the reader follows and the const does NOT — the second half is what proves a consumer
 *      on the const would be wrong, i.e. why the consumers were moved.
 *
 * It builds the snapshot with the reader's own `snapshotFromRows` over the same two tables
 * (`tier <= 2`, as `getTaxonomy()` filters), so it is the reader, minus the network.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import type { PGlite } from '@electric-sql/pglite';

import { createReplayedDb, type ReplayResult } from './replay-migrations';
import { TAXONOMY_MAP, TILE_PARENT } from '../../lib/taxonomy';
import { snapshotFromRows, type CategoryRow, type MapRow } from '../../lib/taxonomy-snapshot';
import {
  deriveBuckets,
  fallbackCanonicalBuckets,
  rollUpCountsToTile,
  servicesForPlanGroup,
  servicesInFolder,
  servicesInTile,
  type CanonicalBuckets,
} from '../../lib/vendor-counts';

let replay: ReplayResult;
let db: PGlite;

before(async () => {
  replay = await createReplayedDb();
  db = replay.db;
});

after(async () => {
  await db?.close();
});

/** `getTaxonomy()` → `deriveBuckets`, against the replayed database. */
async function readerBuckets(): Promise<CanonicalBuckets> {
  // `SELECT *`, not a third hand-typed column list: `snapshotFromRows` reads only the fields
  // `getTaxonomy()` selects, so a superset is the reader's input exactly.
  const cats = await db.query<CategoryRow>(`SELECT * FROM public.service_categories WHERE tier <= 2`);
  const maps = await db.query<MapRow>(`SELECT * FROM public.canonical_service_taxonomy`);
  assert.ok(cats.rows.length > 0 && maps.rows.length > 0, 'the taxonomy seed did not replay — nothing was checked');
  return deriveBuckets(snapshotFromRows(cats.rows, maps.rows));
}

/** Run `fn` inside a transaction that is always rolled back, so each edit is isolated. */
async function asAdminEdit<T>(edit: string[], fn: () => Promise<T>): Promise<T> {
  await db.exec('BEGIN');
  try {
    for (const sql of edit) await db.exec(sql);
    return await fn();
  } finally {
    await db.exec('ROLLBACK');
  }
}

const sorted = (xs: readonly string[]) => [...xs].sort();

function asRecord(m: Map<string, string[]>): Record<string, string[]> {
  return Object.fromEntries([...m].map(([k, v]) => [k, sorted(v)]).sort(([a], [b]) => (a! < b! ? -1 : 1)));
}

/* ═══════════════════════════════════════════════════════════════════════════════════════════
   1 · TODAY'S DATA — the reader's answer is the answer the deleted constants gave
   ═══════════════════════════════════════════════════════════════════════════════════════════ */

/**
 * The deleted constants, FROZEN AS THE PROOF. Until ③0-a, `lib/vendor-counts.ts` built
 * `CANONICAL_SERVICES_BY_TILE` / `_BY_FOLDER` at module load from `TAXONOMY_MAP` with exactly this
 * loop, then force-set the Filipiniana & Barongs tile to a hand list. Re-running that algorithm
 * here and comparing it to the database is "behaviour identical on today's data", measured.
 *
 * If a later migration legitimately adds a Filipiniana service, the hand list below is history,
 * not a spec: add the key to `secondary_tiles` in TAXONOMY_MAP and here in the same change.
 */
const DELETED_FILIPINIANA_HAND_LIST = [
  'filipiniana_terno',
  'filipiniana_maria_clara',
  'filipiniana_balintawak',
  'barong_tagalog_custom',
  'barong_tagalog_rental',
  'maranao_wedding_attire',
  'tausug_wedding_attire',
  'yakan_wedding_attire',
  'muslim_modest_bridal',
  'inc_modest_bridal',
];

function deletedConstants(): { byTile: Map<string, string[]>; byFolder: Map<string, string[]> } {
  const byFolder = new Map<string, string[]>();
  const byTile = new Map<string, string[]>();
  for (const [canonical, meta] of Object.entries(TAXONOMY_MAP)) {
    if (meta.marketplaceHidden) continue;
    byFolder.set(meta.folder, [...(byFolder.get(meta.folder) ?? []), canonical]);
    for (const st of meta.secondary_tiles ?? []) {
      const f = TILE_PARENT[st];
      if (f === meta.folder) continue;
      const arr = byFolder.get(f) ?? [];
      if (!arr.includes(canonical)) byFolder.set(f, [...arr, canonical]);
    }
    if (!meta.tile) continue;
    byTile.set(meta.tile, [...(byTile.get(meta.tile) ?? []), canonical]);
    for (const st of meta.secondary_tiles ?? []) {
      // The old loop knew nothing of this cross-listing — it was the hand list below.
      if (st === meta.tile || st === 'filipiniana_barongs') continue;
      const arr = byTile.get(st) ?? [];
      if (!arr.includes(canonical)) byTile.set(st, [...arr, canonical]);
    }
  }
  byTile.set('filipiniana_barongs', [...DELETED_FILIPINIANA_HAND_LIST]);
  return { byTile, byFolder };
}

test('on the replayed seed, every tile holds exactly the services the deleted constant gave it', async () => {
  const live = await readerBuckets();
  const old = deletedConstants();
  assert.ok(old.byTile.size > 50, `premise: the old constant had ${old.byTile.size} tiles`);
  assert.deepEqual(asRecord(live.byTile as Map<string, string[]>), asRecord(old.byTile));
});

test('on the replayed seed, every group holds exactly the services the deleted constant gave it', async () => {
  const live = await readerBuckets();
  const old = deletedConstants();
  assert.ok(old.byFolder.size >= 10, `premise: the old constant had ${old.byFolder.size} groups`);
  assert.deepEqual(asRecord(live.byFolder as Map<string, string[]>), asRecord(old.byFolder));
});

test('the Filipiniana & Barongs cross-view is DATA now — the database names all ten, the code list is gone', async () => {
  const rows = await db.query<{ canonical_service: string }>(
    `SELECT canonical_service FROM public.canonical_service_taxonomy
      WHERE 'filipiniana_barongs' = ANY (secondary_tiles) ORDER BY 1`,
  );
  assert.deepEqual(
    rows.rows.map((r) => r.canonical_service),
    sorted(DELETED_FILIPINIANA_HAND_LIST),
    'migration one_source_filipiniana_cross_view did not cross-list the ten services',
  );
});

test('the const fallback is the same derivation over the same data — it cannot drift from the reader on the seed', async () => {
  const live = await readerBuckets();
  const fb = fallbackCanonicalBuckets();
  assert.deepEqual(asRecord(live.byTile as Map<string, string[]>), asRecord(fb.byTile as Map<string, string[]>));
  assert.deepEqual(asRecord(live.byFolder as Map<string, string[]>), asRecord(fb.byFolder as Map<string, string[]>));
});

/* ═══════════════════════════════════════════════════════════════════════════════════════════
   2 · AFTER AN ADMIN EDIT — the reader follows; the const would not
   ═══════════════════════════════════════════════════════════════════════════════════════════ */

const NEW_TILE = 'one_source_test_tile';
const NEW_SERVICE = 'one_source_test_service';

const ADD_CATEGORY_AND_SERVICE = [
  `INSERT INTO public.service_categories (id, parent_id, tier, kind, label_en, slug, sort_order)
   VALUES ('${NEW_TILE}', 'look', 2, 'leaf', 'Test category', 'one-source-test-tile', 999)`,
  `INSERT INTO public.canonical_service_taxonomy (canonical_service, folder_id, tile_id, phase)
   VALUES ('${NEW_SERVICE}', 'look', '${NEW_TILE}', 'V1')`,
];

test('an admin adds a category and a service under it → the category, its group and a plan group resolve it', async () => {
  await asAdminEdit(ADD_CATEGORY_AND_SERVICE, async () => {
    const live = await readerBuckets();
    assert.deepEqual(servicesInTile(live, NEW_TILE), [NEW_SERVICE], 'the new category resolves to nothing — every search on it would be empty');
    assert.ok(servicesInFolder(live, 'look').includes(NEW_SERVICE), 'the new service is missing from its group');
    assert.deepEqual(
      servicesForPlanGroup(live, { catalogTile: NEW_TILE, catalogFolder: 'look' }),
      [NEW_SERVICE],
      'a plan group pointing at the new category resolves to nothing',
    );
    const counts = rollUpCountsToTile(new Map([[NEW_SERVICE, { verified: 2, coming_soon: 0, total: 2 }]]), live);
    assert.equal(counts.get(NEW_TILE as never)?.total, 2, 'the supplier count for the new category is lost');

    // …and this is why the consumers moved: the const is blind to it.
    assert.deepEqual(servicesInTile(fallbackCanonicalBuckets(), NEW_TILE), []);
  });
});

test('an admin moves a service to another category → it leaves the old shelf and joins the new one', async () => {
  await asAdminEdit(
    [`UPDATE public.canonical_service_taxonomy SET tile_id = 'grooms_attire' WHERE canonical_service = 'filipiniana_terno'`],
    async () => {
      const live = await readerBuckets();
      assert.ok(servicesInTile(live, 'grooms_attire').includes('filipiniana_terno'));
      assert.ok(!servicesInTile(live, 'brides_attire').includes('filipiniana_terno'));
      assert.ok(servicesInTile(fallbackCanonicalBuckets(), 'brides_attire').includes('filipiniana_terno'), 'premise');
    },
  );
});

test('an admin cross-lists a new service onto Filipiniana & Barongs → the cross-view shows it (it was a hand list)', async () => {
  await asAdminEdit(
    [
      `INSERT INTO public.canonical_service_taxonomy (canonical_service, folder_id, tile_id, phase, secondary_tiles)
       VALUES ('${NEW_SERVICE}', 'look', 'brides_attire', 'V1', ARRAY['filipiniana_barongs'])`,
    ],
    async () => {
      const live = await readerBuckets();
      assert.ok(servicesInTile(live, 'filipiniana_barongs').includes(NEW_SERVICE));
      assert.ok(servicesInTile(live, 'brides_attire').includes(NEW_SERVICE), 'the primary shelf keeps it too');
      assert.equal(servicesInTile(live, 'filipiniana_barongs').length, DELETED_FILIPINIANA_HAND_LIST.length + 1);
    },
  );
});

test('an admin hides a service → it leaves every shelf and every group', async () => {
  await asAdminEdit(
    [`UPDATE public.canonical_service_taxonomy SET marketplace_hidden = true WHERE canonical_service = 'barong_tagalog_custom'`],
    async () => {
      const live = await readerBuckets();
      for (const tile of ['grooms_attire', 'filipiniana_barongs']) {
        assert.ok(!servicesInTile(live, tile).includes('barong_tagalog_custom'), `hidden service still under ${tile}`);
      }
      assert.ok(!servicesInFolder(live, 'look').includes('barong_tagalog_custom'));
    },
  );
});
