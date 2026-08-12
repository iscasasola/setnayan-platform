/**
 * GUARD — the category words in the DATABASE must equal the ones in CODE.
 *
 * WHY THIS EXISTS. The customer-facing marketplace category labels render from
 * two independent places:
 *
 *   1. `lib/taxonomy.ts` — WEDDING_FOLDER_LABEL / WEDDING_FOLDER_SHORT_LABEL.
 *      Read DIRECTLY by the icon-tile strip (`icon-tile-folder-strip.tsx`) and
 *      by the search autocomplete list, which is built at module load.
 *   2. `service_categories.label_en` / `label_short` — read by the live catalog
 *      headings through `getTaxonomy()` (`lib/taxonomy-db.ts`), which falls back
 *      to the constant ONLY when that read is empty or errors.
 *
 * On 2026-08-12, renaming the folders for redesign Session 3, both had to move
 * together. Editing only the code would have left the catalog SECTION HEADINGS
 * reading `Documentary` while the CHIPS DIRECTLY ABOVE THEM read `Photo & video`
 * — one page, two vocabularies, and nothing anywhere throws. There was no guard
 * on this at all; the two copies were only ever kept in step by hand, and the
 * seed generator that created the DB copy is run manually.
 *
 * 🔑 The failure this pins shut is an ABSENCE, not an error — the same family as
 * the phantom column, the phantom enum value and the phantom RPC argument. The
 * only symptom would have been a customer reading two different names for one
 * thing.
 *
 * 🔑 WHY IT COMPARES THE WHOLE MAP AND NOT A SAMPLE. A folder renamed in code
 * with no DB counterpart is exactly the one nobody re-checks. Every tier-1
 * folder is asserted, in both fields, in both directions — a folder present in
 * code and missing from the DB fails too.
 *
 * ⚠️ IF THIS TEST FAILS, DO NOT EDIT THE EXPECTED VALUES TO GO GREEN. It means a
 * label moved in one place only. Move the other one — a migration updating
 * `service_categories`, or the constant in `lib/taxonomy.ts` — so a customer
 * never meets two names for the same shelf.
 *
 * NOTE ON SLUGS: `slug` is asserted UNCHANGED against the code map for the same
 * reason, but it is a much harsher failure — a slug drift breaks every saved and
 * printed `?folder=` URL, not just a word on a page.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import type { PGlite } from '@electric-sql/pglite';
import { createReplayedDb, type ReplayResult } from './replay-migrations';

import {
  WEDDING_FOLDER_ORDER,
  WEDDING_FOLDER_LABEL,
  WEDDING_FOLDER_SHORT_LABEL,
  WEDDING_FOLDER_SLUG,
  type WeddingFolder,
} from '../../lib/taxonomy';

let replay: ReplayResult;
let db: PGlite;

type FolderRow = {
  id: string;
  label_en: string;
  label_short: string | null;
  slug: string;
};

before(async () => {
  replay = await createReplayedDb();
  db = replay.db;
});

after(async () => {
  await db.close();
});

async function tierOneRows(): Promise<FolderRow[]> {
  const res = await db.query<FolderRow>(
    `SELECT id, label_en, label_short, slug
       FROM service_categories
      WHERE tier = 1
      ORDER BY sort_order`,
  );
  return res.rows;
}

test('every folder in code has a tier-1 row in the DB', async () => {
  const rows = await tierOneRows();
  const dbIds = new Set(rows.map((r) => r.id));

  // Assert the anchor before trusting the comparison: a query that returned
  // nothing would make every per-folder check below vacuously pass.
  assert.ok(
    rows.length > 0,
    'no tier-1 rows found in service_categories — the seed did not replay, so this guard proved nothing',
  );

  const missing = WEDDING_FOLDER_ORDER.filter((f) => !dbIds.has(f));
  assert.deepEqual(
    missing,
    [],
    `folder(s) in WEDDING_FOLDER_ORDER with no tier-1 service_categories row: ${missing.join(', ')}`,
  );
});

test('DB label_en matches WEDDING_FOLDER_LABEL for every folder', async () => {
  const rows = await tierOneRows();
  const byId = new Map(rows.map((r) => [r.id, r]));

  const drift: string[] = [];
  for (const folder of WEDDING_FOLDER_ORDER) {
    const row = byId.get(folder);
    if (!row) continue; // covered by the presence test above
    const code = WEDDING_FOLDER_LABEL[folder as WeddingFolder];
    if (row.label_en !== code) {
      drift.push(`${folder}: db="${row.label_en}" code="${code}"`);
    }
  }

  assert.deepEqual(
    drift,
    [],
    `category long labels disagree between the DB and lib/taxonomy.ts.\n` +
      `A customer would read one name in the catalog heading and another in the chip.\n` +
      `Move the missing half — do NOT edit this test.\n  ${drift.join('\n  ')}`,
  );
});

test('DB label_short matches WEDDING_FOLDER_SHORT_LABEL for every folder', async () => {
  const rows = await tierOneRows();
  const byId = new Map(rows.map((r) => [r.id, r]));

  const drift: string[] = [];
  for (const folder of WEDDING_FOLDER_ORDER) {
    const row = byId.get(folder);
    if (!row) continue;
    const code = WEDDING_FOLDER_SHORT_LABEL[folder as WeddingFolder];
    if (row.label_short !== code) {
      drift.push(`${folder}: db="${row.label_short}" code="${code}"`);
    }
  }

  assert.deepEqual(
    drift,
    [],
    `category short labels disagree between the DB and lib/taxonomy.ts.\n` +
      `These render in the icon-tile chips and as the "in <place>" hint on a search row.\n  ${drift.join('\n  ')}`,
  );
});

test('DB slug still matches WEDDING_FOLDER_SLUG — addresses must not move', async () => {
  const rows = await tierOneRows();
  const byId = new Map(rows.map((r) => [r.id, r]));

  const drift: string[] = [];
  for (const folder of WEDDING_FOLDER_ORDER) {
    const row = byId.get(folder);
    if (!row) continue;
    const code = WEDDING_FOLDER_SLUG[folder as WeddingFolder];
    if (row.slug !== code) {
      drift.push(`${folder}: db="${row.slug}" code="${code}"`);
    }
  }

  assert.deepEqual(
    drift,
    [],
    `folder SLUGS disagree between the DB and lib/taxonomy.ts.\n` +
      `This is worse than a label drift: it breaks saved and printed ?folder= URLs.\n  ${drift.join('\n  ')}`,
  );
});

test('no tier-1 folder still carries a retired internal label', async () => {
  // The words the 2026-08-12 rename retired. Kept as an explicit list so the
  // guard states the actual harm ("a customer reads our internal word"), not
  // merely "the two sides agree" — two sides can agree on the WRONG word.
  const RETIRED = new Set([
    'Venue',
    'Planning',
    'Feast',
    'Design',
    'Program',
    'Documentary',
    'Look',
    'Booths',
    'Prints',
    'Transport',
    'Experience',
    'Dining',
    'Logistics & Safety',
    'Insurance & Protection',
  ]);

  const rows = await tierOneRows();
  assert.ok(rows.length > 0, 'no tier-1 rows — nothing was actually checked');

  const stale = rows
    .filter((r) => RETIRED.has(r.label_en))
    .map((r) => `${r.id}="${r.label_en}"`);

  assert.deepEqual(
    stale,
    [],
    `tier-1 folder(s) still show a retired internal word to customers: ${stale.join(', ')}`,
  );
});
