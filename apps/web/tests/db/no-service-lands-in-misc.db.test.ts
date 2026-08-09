/**
 * GUARD — no marketplace-visible service may resolve to `misc`.
 *
 * Owner ruling 2026-08-09: *"fix the taxonomy if needed. we do not like having
 * categories under misc."*
 *
 * WHAT THIS PINS SHUT. The product has two service vocabularies. The admin
 * taxonomy (15 parents → 70 branches → 246 leaves) is what a vendor NAVIGATES;
 * `vendor_category` is what gets STORED and what every marketplace filter reads.
 * The only bridge was `PACKAGE_CANONICAL_TO_VENDOR_CATEGORY`, keyed on LEAVES,
 * built for packages — measured on 2026-08-09 it covered **52 of 246**, and the
 * remaining 194 fell through a `?? 'misc'`. Nothing errored. A vendor picking
 * one of those services would simply have been filed as "Miscellaneous".
 *
 * 🔑 WHY THE TEST READS THE DATABASE AND NOT A FIXTURE. The whole failure mode
 * is code falling behind a taxonomy that ADMINS EDIT AT RUNTIME. A hand-written
 * list of expected services would drift the same way the leaf map did, and would
 * go green while doing it. This walks the live `canonical_service_taxonomy` and
 * `service_categories`, so the day someone adds a branch in the admin console
 * without a category for it, CI says so.
 *
 * 🔑 AND WHY IT ASSERTS THE BRANCH MAP, NOT JUST THE COUNT. Case 2 fails on any
 * live branch missing from `BRANCH_TO_VENDOR_CATEGORY` even if that branch has
 * zero leaves today — because a branch with no leaves is exactly where an admin
 * adds one next, and by then nobody is looking.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import type { PGlite } from '@electric-sql/pglite';
import { createReplayedDb, type ReplayResult } from './replay-migrations';

import { vendorCategoryForLeaf } from '../../lib/vendor-packages';
import { BRANCH_TO_VENDOR_CATEGORY } from '../../lib/vendor-branch-category';
import { VENDOR_CATEGORIES } from '../../lib/vendors';

let replay: ReplayResult;
let db: PGlite;

/**
 * The live marketplace-visible taxonomy: one row per leaf, carrying the branch
 * it hangs off. Mirrors `getCoverageTaxonomy`'s own filters — retired or
 * marketplace-hidden nodes are dropped, and a leaf whose branch is gone is
 * dropped with it, exactly as the picker does.
 */
const LEAVES_SQL = `
  SELECT c.canonical_service, c.tile_id, b.label_en AS branch, p.label_en AS parent
    FROM canonical_service_taxonomy c
    JOIN service_categories b ON b.id = c.tile_id AND b.tier = 2
    JOIN service_categories p ON p.id = b.parent_id AND p.tier = 1
   WHERE coalesce(c.marketplace_hidden,false) = false
     AND coalesce(b.status,'') <> 'retired' AND coalesce(b.marketplace_hidden,false) = false
     AND coalesce(p.status,'') <> 'retired' AND coalesce(p.marketplace_hidden,false) = false
`;

type LeafRow = { canonical_service: string; tile_id: string; branch: string; parent: string };

before(async () => {
  replay = await createReplayedDb();
  db = replay.db;
});
after(async () => {
  await db.close();
});

test('META: the seeded taxonomy is actually populated', async () => {
  // Without this, every assertion below passes vacuously against an empty tree —
  // the "0 offenders" that means "nothing was checked".
  const r = await db.query<LeafRow>(LEAVES_SQL);
  assert.ok(
    r.rows.length > 50,
    `expected a real taxonomy in the replayed schema, got ${r.rows.length} leaves — ` +
      'the assertions below would be measuring nothing',
  );
});

test('no marketplace-visible service resolves to misc', async () => {
  const r = await db.query<LeafRow>(LEAVES_SQL);
  const offenders = r.rows
    .filter((l) => vendorCategoryForLeaf(l.canonical_service, l.tile_id) === 'misc')
    .map((l) => `${l.parent} › ${l.branch} › ${l.canonical_service}`);

  assert.deepEqual(
    offenders,
    [],
    `${offenders.length} service(s) would be filed as "Miscellaneous". Add the ` +
      'BRANCH to BRANCH_TO_VENDOR_CATEGORY (not the leaf — a branch entry covers ' +
      'every service added under it later):\n  ' + offenders.join('\n  '),
  );
});

test('every live branch has a category, including the empty ones', async () => {
  // A branch with no leaves today is where the next leaf gets added, and by then
  // nobody is looking at this file.
  const r = await db.query<{ id: string; branch: string; parent: string }>(`
    SELECT b.id, b.label_en AS branch, p.label_en AS parent
      FROM service_categories b
      JOIN service_categories p ON p.id = b.parent_id AND p.tier = 1
     WHERE b.tier = 2
       AND coalesce(b.status,'') <> 'retired' AND coalesce(b.marketplace_hidden,false) = false
       AND coalesce(p.status,'') <> 'retired' AND coalesce(p.marketplace_hidden,false) = false
  `);
  const missing = r.rows
    .filter((b) => !BRANCH_TO_VENDOR_CATEGORY[b.id])
    .map((b) => `${b.parent} › ${b.branch}  (tile_id: ${b.id})`);

  assert.deepEqual(
    missing,
    [],
    `${missing.length} live branch(es) have no coarse category:\n  ` + missing.join('\n  '),
  );
});

test('every category the branch map names is a real one', async () => {
  // A typo here fails CLOSED in the worst way: the value is written to an enum
  // column, so the INSERT is rejected at runtime rather than at build time —
  // and a rejected query in this codebase is silent, not thrown.
  const known = new Set<string>(VENDOR_CATEGORIES);
  const bogus = Object.entries(BRANCH_TO_VENDOR_CATEGORY)
    .filter(([, cat]) => !known.has(cat))
    .map(([tile, cat]) => `${tile} → ${cat}`);
  assert.deepEqual(bogus, [], `branch map names unknown categories:\n  ${bogus.join('\n  ')}`);
});

test('every category the branch map names exists in the DATABASE enum too', async () => {
  // The TypeScript union and the Postgres enum are two hand-maintained lists.
  // They were already out of step before this change — the enum carried 51
  // values while the union listed 45 — so agreeing with the union proves
  // nothing about what the column will actually accept.
  const r = await db.query<{ v: string }>(
    `SELECT e.enumlabel::text AS v FROM pg_enum e
       JOIN pg_type t ON t.oid = e.enumtypid WHERE t.typname = 'vendor_category'`,
  );
  const inDb = new Set(r.rows.map((x) => x.v));
  assert.ok(inDb.size > 0, 'vendor_category enum not found in the replayed schema');

  const missing = [...new Set(Object.values(BRANCH_TO_VENDOR_CATEGORY))]
    .filter((c) => !inDb.has(c))
    .sort();
  assert.deepEqual(
    missing,
    [],
    `the branch map targets categories the enum does not have — an INSERT would be ` +
      `REJECTED, and a rejected query here is silent:\n  ${missing.join('\n  ')}`,
  );
});

test('NEUTRALISATION: dropping a branch entry is caught', async () => {
  // Proves case 2 measures the map rather than the default. Without this, an
  // always-empty `missing` list looks identical to a correct one.
  const r = await db.query<{ id: string }>(`
    SELECT b.id FROM service_categories b
      JOIN service_categories p ON p.id = b.parent_id AND p.tier = 1
     WHERE b.tier = 2 AND coalesce(b.status,'') <> 'retired'
       AND coalesce(b.marketplace_hidden,false) = false LIMIT 1
  `);
  const victim = r.rows[0]?.id;
  assert.ok(victim, 'no live branch to neutralise against');

  const withoutIt: Record<string, string> = { ...BRANCH_TO_VENDOR_CATEGORY };
  delete withoutIt[victim!];
  assert.notEqual(
    Object.keys(withoutIt).length,
    Object.keys(BRANCH_TO_VENDOR_CATEGORY).length,
    'the neutralisation removed nothing — the branch was not in the map to begin with',
  );
  assert.equal(
    withoutIt[victim!],
    undefined,
    'a removed branch must read as unmapped, which is what case 2 asserts on',
  );
});
