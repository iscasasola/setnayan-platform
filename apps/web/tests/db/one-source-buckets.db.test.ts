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
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

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

/*
 * ⚖ TAXONOMY V2 (owner-approved 2026-11-06, DECISION_LOG "TAXONOMY V2 APPROVED"; migration `20271320461004`). V2 folds
 * the Filipiniana & Barongs cross-view into Bride's attire and merges all ten of its services into the custom gown /
 * custom suit as specialty values — so the tile the old constant FORCE-SET is now a tombstone with no live service, and
 * a reader that still answered it would be the bug. The frozen algorithm below is unchanged; the comparison sets that
 * one forced key aside and proves, separately, that it is exactly the fold (every one of the ten is merged where v2 says,
 * nothing cross-lists the tombstone, and the reader has no bucket for it).
 */
const V2 = JSON.parse(
  readFileSync(join(__dirname, '..', '..', '..', '..', 'supabase', 'data', 'taxonomy-v2-2026-11-06.json'), 'utf8'),
) as {
  groups: { categories: { tile: string }[] }[];
  live_key_map: Record<string, { service: string; as: string }>;
};
const V2_CATEGORY_COUNT = V2.groups.flatMap((g) => g.categories).length;
const FOLDED_CROSS_VIEW = 'filipiniana_barongs';

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
  // Premise re-pointed at v2: every one of its categories holds at least one service (was "> 50" on the pre-v2 tiles).
  assert.ok(old.byTile.size >= V2_CATEGORY_COUNT, `premise: the old constant had ${old.byTile.size} tiles, v2 has ${V2_CATEGORY_COUNT} categories`);
  assert.equal(live.byTile.has(FOLDED_CROSS_VIEW), false, 'the reader still answers the folded Filipiniana tile');
  const oldMinusFold = new Map(old.byTile);
  oldMinusFold.delete(FOLDED_CROSS_VIEW);
  assert.deepEqual(asRecord(live.byTile as Map<string, string[]>), asRecord(oldMinusFold));
});

test('on the replayed seed, every group holds exactly the services the deleted constant gave it', async () => {
  const live = await readerBuckets();
  const old = deletedConstants();
  assert.ok(old.byFolder.size >= 10, `premise: the old constant had ${old.byFolder.size} groups`);
  assert.deepEqual(asRecord(live.byFolder as Map<string, string[]>), asRecord(old.byFolder));
});

test('the Filipiniana & Barongs cross-view is DATA now — v2 folds it, and all ten land where v2 says', async () => {
  // Pre-v2 this asserted all ten were cross-listed under the tile. V2 folds the tile and merges the ten, so the
  // same ten are now asserted, one by one, to forward to v2's service for them — and nothing still names the tombstone.
  const tile = await db.query<{ status: string; merged_into_category_id: string | null }>(
    `SELECT status, merged_into_category_id FROM public.service_categories WHERE id = $1`,
    [FOLDED_CROSS_VIEW],
  );
  assert.deepEqual(tile.rows[0], { status: 'retired', merged_into_category_id: 'brides_attire' });
  const cross = await db.query<{ canonical_service: string }>(
    `SELECT canonical_service FROM public.canonical_service_taxonomy WHERE $1 = ANY (secondary_tiles) ORDER BY 1`,
    [FOLDED_CROSS_VIEW],
  );
  assert.deepEqual(cross.rows, [], 'a service still cross-lists the folded Filipiniana tile');
  const rows = await db.query<{ canonical_service: string; merged_into: string | null; marketplace_hidden: boolean }>(
    `SELECT canonical_service, merged_into, marketplace_hidden FROM public.canonical_service_taxonomy
      WHERE canonical_service = ANY ($1::text[]) ORDER BY 1`,
    [DELETED_FILIPINIANA_HAND_LIST],
  );
  assert.equal(rows.rows.length, 10, 'one of the ten Filipiniana services is gone from the table');
  for (const r of rows.rows) {
    const want = V2.live_key_map[r.canonical_service];
    assert.ok(want, `v2 does not place ${r.canonical_service}`);
    assert.deepEqual(
      { merged_into: r.merged_into, hidden: r.marketplace_hidden },
      { merged_into: want.service, hidden: true },
      `${r.canonical_service} does not forward where v2 places it`,
    );
  }
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

// ⚖ TAXONOMY V2: `filipiniana_terno` is merged into `bridal_gown_custom` (a specialty value now, on no shelf), so the
// service the admin moves is the live one that absorbed it.
test('an admin moves a service to another category → it leaves the old shelf and joins the new one', async () => {
  const MOVED = 'bridal_gown_custom';
  assert.ok(servicesInTile(await readerBuckets(), 'brides_attire').includes(MOVED), 'premise: the witness is on its shelf');
  await asAdminEdit(
    [`UPDATE public.canonical_service_taxonomy SET tile_id = 'grooms_attire' WHERE canonical_service = '${MOVED}'`],
    async () => {
      const live = await readerBuckets();
      assert.ok(servicesInTile(live, 'grooms_attire').includes(MOVED));
      assert.ok(!servicesInTile(live, 'brides_attire').includes(MOVED));
      assert.ok(servicesInTile(fallbackCanonicalBuckets(), 'brides_attire').includes(MOVED), 'premise');
    },
  );
});

// ⚖ TAXONOMY V2: the Filipiniana & Barongs cross-view is folded (test 3 proves it), so the cross-listing is asked of a
// live second shelf — Barong & suits — and counted against that shelf's own size before the edit.
test('an admin cross-lists a new service onto a second category → that shelf shows it (it was a hand list)', async () => {
  const CROSS = 'grooms_attire';
  const sizeBefore = servicesInTile(await readerBuckets(), CROSS).length;
  assert.ok(sizeBefore > 0, 'premise: the second shelf is not empty');
  await asAdminEdit(
    [
      `INSERT INTO public.canonical_service_taxonomy (canonical_service, folder_id, tile_id, phase, secondary_tiles)
       VALUES ('${NEW_SERVICE}', 'look', 'brides_attire', 'V1', ARRAY['${CROSS}'])`,
    ],
    async () => {
      const live = await readerBuckets();
      assert.ok(servicesInTile(live, CROSS).includes(NEW_SERVICE));
      assert.ok(servicesInTile(live, 'brides_attire').includes(NEW_SERVICE), 'the primary shelf keeps it too');
      assert.equal(servicesInTile(live, CROSS).length, sizeBefore + 1);
    },
  );
});

// ⚖ TAXONOMY V2: `barong_tagalog_custom` is already merged (hidden) into `groom_suit_custom`, so hiding it again proved
// nothing — this asked a question whose answer was fixed before the edit. The service hidden is the live survivor, and
// the premise checks it is on its shelf and in its group first.
test('an admin hides a service → it leaves every shelf and every group', async () => {
  const HIDDEN = 'groom_suit_custom';
  const base = await readerBuckets();
  assert.ok(servicesInTile(base, 'grooms_attire').includes(HIDDEN) && servicesInFolder(base, 'look').includes(HIDDEN), 'premise: the witness is live');
  await asAdminEdit(
    [`UPDATE public.canonical_service_taxonomy SET marketplace_hidden = true WHERE canonical_service = '${HIDDEN}'`],
    async () => {
      const live = await readerBuckets();
      for (const tile of ['grooms_attire', 'brides_attire']) {
        assert.ok(!servicesInTile(live, tile).includes(HIDDEN), `hidden service still under ${tile}`);
      }
      assert.ok(!servicesInFolder(live, 'look').includes(HIDDEN));
    },
  );
});
