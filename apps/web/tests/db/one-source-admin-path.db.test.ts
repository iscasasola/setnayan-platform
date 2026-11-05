/**
 * ONE SOURCE · THE ADMIN PATH — /admin/categories can cross-list a service onto a category it
 * just created, and can clear a cross-listing (test:db, migrations replayed).
 *
 * ③0-d of the taxonomy build (corpus `prototypes/admin_taxonomy_four_levels_2026-10-26/PLAN.md`
 * § 8.3; audit B1). `setServiceSecondaryTiles` validated the admin's pick against the CODE tile
 * list (`WEDDING_TILE_ORDER`), so the page answered "Unknown category(s)" for a category the same
 * page had made a minute earlier — the page the owner is approving could not use its own output.
 * It now validates against the tier-2 `service_categories` rows (`secondaryTilesVerdict`). This
 * file runs that rule against the replayed tables, before and after a simulated admin edit.
 *
 * It also pins the second defect found on the same line: "None" was saved as NULL, and
 * `secondary_tiles` is `NOT NULL DEFAULT '{}'` — so clearing a cross-listing was refused by the
 * database every time.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import type { PGlite } from '@electric-sql/pglite';

import { createReplayedDb, type ReplayResult } from './replay-migrations';
import { WEDDING_TILE_ORDER } from '../../lib/taxonomy';
import { secondaryTilesVerdict } from '../../app/admin/categories/_components/model';

let replay: ReplayResult;
let db: PGlite;

before(async () => {
  replay = await createReplayedDb();
  db = replay.db;
});

after(async () => {
  await db?.close();
});

/** Exactly the read the action makes: the tier-2 ids that exist now. */
async function liveCategoryIds(): Promise<string[]> {
  const res = await db.query<{ id: string }>(`SELECT id FROM public.service_categories WHERE tier = 2`);
  assert.ok(res.rows.length > 50, 'the category seed did not replay — nothing was checked');
  return res.rows.map((r) => r.id);
}

async function asAdminEdit<T>(edit: string[], fn: () => Promise<T>): Promise<T> {
  await db.exec('BEGIN');
  try {
    for (const sql of edit) await db.exec(sql);
    return await fn();
  } finally {
    await db.exec('ROLLBACK');
  }
}

const NEW_TILE = 'one_source_admin_made_tile';

test('on the replayed seed the live rule accepts every category the code list accepted', async () => {
  const live = await liveCategoryIds();
  const verdict = secondaryTilesVerdict([...WEDDING_TILE_ORDER], null, live);
  assert.ok(verdict.ok, `the live categories refuse code tiles: ${!verdict.ok ? verdict.unknown.join(', ') : ''}`);
});

test('an admin creates a category → a service can be cross-listed onto it at once (the code list refused it)', async () => {
  await asAdminEdit(
    [
      `INSERT INTO public.service_categories (id, parent_id, tier, kind, label_en, slug, sort_order)
       VALUES ('${NEW_TILE}', 'look', 2, 'leaf', 'Admin-made category', 'one-source-admin-made', 999)`,
    ],
    async () => {
      const verdict = secondaryTilesVerdict([NEW_TILE], 'brides_attire', await liveCategoryIds());
      assert.deepEqual(verdict, { ok: true, next: [NEW_TILE] });
      // The defect, measured: the code list does not know it.
      assert.equal(secondaryTilesVerdict([NEW_TILE], 'brides_attire', WEDDING_TILE_ORDER).ok, false);
      // …and the write the action then makes lands.
      await db.exec(
        `UPDATE public.canonical_service_taxonomy SET secondary_tiles = ARRAY['${NEW_TILE}'] WHERE canonical_service = 'filipiniana_terno'`,
      );
      const row = await db.query<{ secondary_tiles: string[] }>(
        `SELECT secondary_tiles FROM public.canonical_service_taxonomy WHERE canonical_service = 'filipiniana_terno'`,
      );
      assert.deepEqual(row.rows[0]?.secondary_tiles, [NEW_TILE]);
    },
  );
});

test('a category an admin deleted is refused — the rule follows the table both ways', async () => {
  const live = (await liveCategoryIds()).filter((id) => id !== 'dance_floor');
  const verdict = secondaryTilesVerdict(['dance_floor'], 'reception', live);
  assert.deepEqual(verdict, { ok: false, unknown: ['dance_floor'] });
});

test('"None" saves: the rule answers [] and the column takes it — NULL is refused by the database', async () => {
  const verdict = secondaryTilesVerdict([], 'reception', await liveCategoryIds());
  assert.deepEqual(verdict, { ok: true, next: [] });
  await asAdminEdit([], async () => {
    await db.exec(`UPDATE public.canonical_service_taxonomy SET secondary_tiles = '{}' WHERE canonical_service = 'accommodation'`);
    await assert.rejects(
      db.exec(`UPDATE public.canonical_service_taxonomy SET secondary_tiles = NULL WHERE canonical_service = 'accommodation'`),
      /null value|not-null|violates/i,
      'premise moved: secondary_tiles accepts NULL now',
    );
  });
});
