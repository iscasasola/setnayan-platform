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
 * ⚠ OPEN OWNER QUESTION, pinned rather than guessed: a category created with NO coarse category
 * still resolves to `misc` (case "a new category with no coarse category…"). How a new category
 * gets one — chosen on create, set on its panel, inherited — is a product call this PR does not
 * make. When it is made, that case changes.
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
  const ids = new Set(rows.rows.map((r) => r.id));
  for (const id of Object.keys(BRANCH_TO_VENDOR_CATEGORY)) {
    if (!ids.has(id)) drift.push(`${id}: in the code map, no category row`);
  }
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

test('OPEN OWNER QUESTION — a new category with no coarse category still files its shops under misc', async () => {
  await asAdminEdit(addCategory(null), async () => {
    const live = await taxonomyFromDb(db);
    assert.equal(vendorCategoryForLeaf(NEW_SERVICE, NEW_TILE, live), 'misc');
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
