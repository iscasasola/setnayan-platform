/**
 * ONE SOURCE · THE COARSE CATEGORY — which coarse `vendor_category` a category files its shops
 * under is the database column `service_categories.coarse_category`, and the resolvers follow an
 * admin's edit of it (test:db, migrations replayed).
 *
 * ③0-c of the taxonomy build (corpus `prototypes/admin_taxonomy_four_levels_2026-10-26/PLAN.md`
 * § 8.3). The answer used to be a code map (`BRANCH_TO_VENDOR_CATEGORY`), so a category an admin
 * created had none and every shop under it was stored as `misc` ("Miscellaneous") — silently.
 *
 *   1. ON TODAY'S DATA nothing moves: the column holds exactly the map's value for every category,
 *      and every resolver answers the same from the database as from the code snapshot, for every
 *      visible service and every category.
 *   2. AFTER A SIMULATED ADMIN EDIT (a new category given a coarse category; an existing category
 *      re-filed) the resolvers follow and the code snapshot does not.
 *   3. THE REFUSAL: deleting a category a couple-side category is anchored on is refused
 *      (`deletionWouldBreakCoupleLinks`, called by `deleteTileWithDestination`), where it used to be
 *      a number on the admin page read after the damage.
 *
 * A NEW category inherits its group's most common coarse category (controller decision
 * 2026-10-26; trigger `service_categories_inherit_coarse_category`, ③0-c part 2) — section 2b.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import type { PGlite } from '@electric-sql/pglite';

import { createReplayedDb, type ReplayResult } from './replay-migrations';
import { taxonomyFromDb } from './taxonomy-from-db';
import { fallbackSnapshot } from '../../lib/taxonomy-snapshot';
import { BRANCH_TO_VENDOR_CATEGORY, categoryForBranch } from '../../lib/vendor-branch-category';
import { vendorCategoryForLeaf } from '../../lib/vendor-packages';
import {
  eventVendorCategoryForCardKind,
  eventVendorCategoryKeyForCardKind,
} from '../../lib/event-vendor-category';
import { deletionWouldBreakCoupleLinks } from '../../lib/vendor-category-taxonomy';

let replay: ReplayResult;
let db: PGlite;

before(async () => {
  replay = await createReplayedDb();
  db = replay.db;
});

after(async () => {
  await db?.close();
});

async function asAdminEdit<T>(edit: string[], fn: () => Promise<T>): Promise<T> {
  await db.exec('BEGIN');
  try {
    for (const sql of edit) await db.exec(sql);
    return await fn();
  } finally {
    await db.exec('ROLLBACK');
  }
}

/* ═════ 1 · TODAY'S DATA ═════════════════════════════════════════════════════════════════════ */

test('the column holds exactly the code map, category for category', async () => {
  const rows = await db.query<{ id: string; coarse_category: string | null }>(
    `SELECT id, coarse_category::text AS coarse_category FROM public.service_categories WHERE tier = 2`,
  );
  assert.ok(rows.rows.length > 50, 'premise: the categories replayed');
  const drift: string[] = [];
  for (const r of rows.rows) {
    const code = BRANCH_TO_VENDOR_CATEGORY[r.id] ?? null;
    if (r.coarse_category !== code) drift.push(`${r.id}: db=${r.coarse_category} code=${code}`);
  }
  // The other direction is NOT asserted: the code map carries three keys no migration ever made a
  // category for (`casket_urn`, `embalming`, `hearse` — the 2026-08-27 wake branches that landed as
  // one `funeral_home` category). With no row there is nothing to file a shop under, so they change
  // no answer; they are dead lines in the fallback, reported for cleanup rather than copied.
  assert.deepEqual(drift, [], `the migration did not copy the map faithfully:\n  ${drift.join('\n  ')}`);
});

test('every resolver answers the same from the database as from the code snapshot', async () => {
  const live = await taxonomyFromDb(db);
  const code = fallbackSnapshot();
  const leaves = await db.query<{ canonical_service: string; tile_id: string | null }>(
    `SELECT canonical_service, tile_id FROM public.canonical_service_taxonomy WHERE NOT marketplace_hidden`,
  );
  const tiles = await db.query<{ id: string }>(`SELECT id FROM public.service_categories WHERE tier = 2`);
  assert.ok(leaves.rows.length > 100 && tiles.rows.length > 50, 'premise');
  const diff: string[] = [];
  for (const l of leaves.rows) {
    const a = vendorCategoryForLeaf(l.canonical_service, l.tile_id, live);
    const b = vendorCategoryForLeaf(l.canonical_service, l.tile_id, code);
    if (a !== b) diff.push(`leaf ${l.canonical_service}: db=${a} code=${b}`);
  }
  for (const t of tiles.rows) {
    const a = eventVendorCategoryForCardKind(t.id, null, live);
    const b = eventVendorCategoryForCardKind(t.id, null, code);
    if (a !== b) diff.push(`tile ${t.id}: db=${a} code=${b}`);
    if (eventVendorCategoryKeyForCardKind(t.id, null, live) !== eventVendorCategoryKeyForCardKind(t.id, null, code)) {
      diff.push(`tile ${t.id}: category_key differs`);
    }
  }
  assert.deepEqual(diff, []);
});

/* ═════ 2 · AFTER AN ADMIN EDIT ══════════════════════════════════════════════════════════════ */

const NEW_TILE = 'one_source_drone_shows';
const NEW_SERVICE = 'one_source_drone_light_show';

const addCategory = (coarse: string | null) => [
  `INSERT INTO public.service_categories (id, parent_id, tier, kind, label_en, slug, sort_order, coarse_category)
   VALUES ('${NEW_TILE}', 'design', 2, 'leaf', 'Drone shows', 'one-source-drone-shows', 999, ${coarse ? `'${coarse}'` : 'NULL'})`,
  `INSERT INTO public.canonical_service_taxonomy (canonical_service, folder_id, tile_id, phase)
   VALUES ('${NEW_SERVICE}', 'design', '${NEW_TILE}', 'V1')`,
];

test('an admin creates a category and gives it a coarse category → its shops are filed there, not under misc', async () => {
  await asAdminEdit(addCategory('reception_decor'), async () => {
    const live = await taxonomyFromDb(db);
    assert.equal(vendorCategoryForLeaf(NEW_SERVICE, NEW_TILE, live), 'reception_decor');
    assert.equal(eventVendorCategoryForCardKind(NEW_SERVICE, NEW_TILE, live), 'reception_decor');
    assert.equal(eventVendorCategoryForCardKind(NEW_TILE, null, live), 'reception_decor', 'a card filed under the category id itself');
    assert.equal(eventVendorCategoryKeyForCardKind(NEW_TILE, null, live), NEW_TILE);
    // …and the stored row is one the enum column accepts.
    await db.exec(`SELECT '${vendorCategoryForLeaf(NEW_SERVICE, NEW_TILE, live)}'::public.vendor_category`);
    // Why the resolver moved: the code map is blind to it.
    assert.equal(vendorCategoryForLeaf(NEW_SERVICE, NEW_TILE, fallbackSnapshot()), 'misc');
  });
});

test('an admin re-files an existing category → the resolvers follow', async () => {
  await asAdminEdit([`UPDATE public.service_categories SET coarse_category = 'performers' WHERE id = 'fireworks'`], async () => {
    const live = await taxonomyFromDb(db);
    assert.equal(categoryForBranch('fireworks', live), 'performers');
    assert.equal(categoryForBranch('fireworks', fallbackSnapshot()), BRANCH_TO_VENDOR_CATEGORY.fireworks, 'premise');
  });
});

/* ═════ 2b · A NEW CATEGORY INHERITS ITS GROUP'S COARSE CATEGORY (③0-c part 2) ═══════════════
   Controller decision 2026-10-26: a new category created with no coarse category takes its group's
   most common sibling value; ties → the first sibling by sort_order; no sibling with a value → NULL.
   Enforced by the BEFORE INSERT trigger `service_categories_inherit_coarse_category`, so every door
   that creates a category (the admin page's `createTaxonomyNode` today) gets it. */

const GROUP = 'one_source_test_group';
const tier1 = `INSERT INTO public.service_categories (id, parent_id, tier, kind, label_en, slug, sort_order)
  VALUES ('${GROUP}', NULL, 1, 'branch', 'Test group', 'one-source-test-group', 999)`;
const sibling = (id: string, sort: number, coarse: string | null) =>
  `INSERT INTO public.service_categories (id, parent_id, tier, kind, label_en, slug, sort_order, coarse_category)
   VALUES ('${id}', '${GROUP}', 2, 'leaf', '${id}', '${id.replace(/_/g, '-')}', ${sort}, ${coarse ? `'${coarse}'` : 'NULL'})`;
const created = `INSERT INTO public.service_categories (id, parent_id, tier, kind, label_en, slug, sort_order)
  VALUES ('${NEW_TILE}', '${GROUP}', 2, 'leaf', 'Drone shows', 'one-source-drone-shows', 99)`;

async function storedCoarse(id: string): Promise<string | null> {
  const r = await db.query<{ c: string | null }>(
    `SELECT coarse_category::text AS c FROM public.service_categories WHERE id = $1`,
    [id],
  );
  return r.rows[0]?.c ?? null;
}

test('a new category with no coarse category inherits its group\'s MOST COMMON one — and its shops are filed there, not under misc', async () => {
  await asAdminEdit(
    [
      tier1,
      sibling('os_a', 0, 'florist'),
      sibling('os_b', 1, 'performers'),
      sibling('os_c', 2, 'performers'),
      created,
      `INSERT INTO public.canonical_service_taxonomy (canonical_service, folder_id, tile_id, phase)
       VALUES ('${NEW_SERVICE}', '${GROUP}', '${NEW_TILE}', 'V1')`,
    ],
    async () => {
      assert.equal(await storedCoarse(NEW_TILE), 'performers');
      const live = await taxonomyFromDb(db);
      assert.equal(vendorCategoryForLeaf(NEW_SERVICE, NEW_TILE, live), 'performers');
      assert.equal(eventVendorCategoryForCardKind(NEW_TILE, null, live), 'performers');
    },
  );
});

test('a tie goes to the first sibling by sort_order', async () => {
  await asAdminEdit([tier1, sibling('os_b', 1, 'performers'), sibling('os_a', 0, 'florist'), created], async () => {
    assert.equal(await storedCoarse(NEW_TILE), 'florist');
  });
});

test('siblings with no value do not vote; a group with no sibling value leaves it NULL (→ misc, listed for a look)', async () => {
  await asAdminEdit([tier1, sibling('os_a', 0, null), created], async () => {
    assert.equal(await storedCoarse(NEW_TILE), null);
    const live = await taxonomyFromDb(db);
    assert.equal(vendorCategoryForLeaf(NEW_SERVICE, NEW_TILE, live), 'misc');
  });
});

test('an explicit coarse category on create wins, and the rule touches no existing row', async () => {
  await asAdminEdit(addCategory('florist'), async () => {
    assert.equal(await storedCoarse(NEW_TILE), 'florist', 'the trigger overwrote a value it was given');
  });
  await asAdminEdit([`UPDATE public.service_categories SET coarse_category = NULL WHERE id = 'fireworks'`], async () => {
    assert.equal(await storedCoarse('fireworks'), null, 'the rule must not run on UPDATE');
  });
});

test('in a real group the inherited value is the siblings\' mode, computed independently here', async () => {
  const sibs = await db.query<{ c: string; sort_order: number }>(
    `SELECT coarse_category::text AS c, sort_order FROM public.service_categories
      WHERE parent_id = 'design' AND tier = 2 AND coarse_category IS NOT NULL`,
  );
  const tally = new Map<string, { n: number; first: number }>();
  for (const r of sibs.rows) {
    const t = tally.get(r.c) ?? { n: 0, first: Number.POSITIVE_INFINITY };
    tally.set(r.c, { n: t.n + 1, first: Math.min(t.first, r.sort_order) });
  }
  const expected = [...tally].sort((x, y) => y[1].n - x[1].n || x[1].first - y[1].first)[0]?.[0];
  assert.ok(expected, 'premise: design has categories with a coarse category');
  await asAdminEdit(addCategory(null), async () => {
    assert.equal(await storedCoarse(NEW_TILE), expected);
  });
});

/* ═════ 3 · THE REFUSAL ══════════════════════════════════════════════════════════════════════ */

test('deleting a category a couple-side category is anchored on is refused; an unanchored one is not', async () => {
  const live = await taxonomyFromDb(db);
  const refused = deletionWouldBreakCoupleLinks(live, 'reception');
  assert.ok(
    refused.some((d) => d.category === 'venue'),
    `deleting Reception should be refused — couples' venues are filed there (got ${JSON.stringify(refused)})`,
  );
  await asAdminEdit(addCategory('reception_decor'), async () => {
    assert.deepEqual(deletionWouldBreakCoupleLinks(await taxonomyFromDb(db), NEW_TILE), []);
  });
});
