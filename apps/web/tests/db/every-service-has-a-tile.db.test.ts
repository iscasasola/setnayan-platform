/**
 * GUARD — every canonical service is FILED on a branch, and filing it never
 * put it in front of a customer.
 *
 * Owner, 2026-08-27, on `/admin/taxonomy?view=unfiled`: *"there are so many
 * that are not added on the taxonomy. or not categorized properly."*
 *
 * WHAT WAS ACTUALLY WRONG. 30 rows in `canonical_service_taxonomy` carried a
 * folder and a NULL `tile_id` — every celebrant, the pre-marriage seminars, the
 * marriage paperwork, and the honeymoon planners. The four branches that are
 * their exact homes existed and were EMPTY. The two halves of one gap, sitting
 * next to each other in the same table for three months, because the
 * 2026-05-31 marketplace-shrink expressed "not sold here" by ALSO omitting the
 * tile. Migration `20271172444653` files all 30.
 *
 * 🔑 WHY THIS TEST HAS TO ASSERT BOTH DIRECTIONS. "Every service has a tile" on
 * its own is satisfied by a change that files these AND makes them sellable —
 * which would silently open a supplier category (officiants, marriage licences)
 * the owner has never agreed to sell. Case 5 pins the hidden flag on all 30
 * leaves and on all four branches, so the day someone widens visibility it is a
 * deliberate edit to this file rather than a side effect of tidying.
 *
 * 🔑 AND WHY THE BRANCH SET IS READ FROM THE TABLE, NOT HAND-LISTED. The four
 * branches were created THROUGH THE ADMIN CONSOLE on 2026-07-03 and no
 * migration had ever named them, so they existed in production and in no other
 * database on earth — an `UPDATE … WHERE id IN ('officiants', …)` in
 * `20270832295038` had been matching zero rows in every replay since it merged.
 * Case 1's floor is what makes that class of silence audible: if the tree isn't
 * really there, the assertions below are measuring nothing and it says so.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import type { PGlite } from '@electric-sql/pglite';
import { createReplayedDb, type ReplayResult } from './replay-migrations';

let replay: ReplayResult;
let db: PGlite;

/** The four branches that exist to hold deliberately-unsold services. */
const ADMIN_ONLY_BRANCHES = [
  'officiants',
  'counseling_seminars',
  'wedding_paperwork',
  'travel_honeymoon',
] as const;

before(async () => {
  replay = await createReplayedDb();
  db = replay.db;
});
after(async () => {
  await db.close();
});

test('META: the taxonomy is really populated in this replay', async () => {
  // Without this floor every assertion below passes vacuously against an empty
  // tree — the "0 offenders" that means "nothing was checked".
  const rows = await db.query<{ n: number }>(
    'SELECT count(*)::int AS n FROM canonical_service_taxonomy',
  );
  const tiles = await db.query<{ n: number }>(
    "SELECT count(*)::int AS n FROM service_categories WHERE tier = 2",
  );
  assert.ok(
    (rows.rows[0]?.n ?? 0) > 200,
    `expected a real taxonomy, got ${rows.rows[0]?.n} canonical mappings`,
  );
  assert.ok(
    (tiles.rows[0]?.n ?? 0) > 50,
    `expected a real branch tree, got ${tiles.rows[0]?.n} tier-2 branches`,
  );
});

test('no canonical service is left unfiled', async () => {
  const r = await db.query<{ canonical_service: string; folder_id: string }>(
    `SELECT canonical_service, folder_id
       FROM canonical_service_taxonomy
      WHERE tile_id IS NULL OR tile_id = ''
      ORDER BY canonical_service`,
  );
  assert.deepEqual(
    r.rows.map((x) => `${x.folder_id} › ${x.canonical_service}`),
    [],
    `${r.rows.length} service(s) have no branch — they land in the admin's ` +
      '"Unfiled" tray and belong to nobody. Give each one a tile_id (create the ' +
      'branch in the same migration if it does not exist yet).',
  );
});

test('every tile_id names a live tier-2 branch', async () => {
  // The foreign key proves the id EXISTS; it says nothing about which tier it
  // is on. A canonical hung off a tier-1 folder renders in no picker at all.
  const r = await db.query<{ canonical_service: string; tile_id: string; tier: number | null }>(
    `SELECT t.canonical_service, t.tile_id, c.tier
       FROM canonical_service_taxonomy t
       LEFT JOIN service_categories c ON c.id = t.tile_id
      WHERE t.tile_id IS NOT NULL
        AND (c.id IS NULL OR c.tier <> 2 OR coalesce(c.status,'') = 'retired')
      ORDER BY t.canonical_service`,
  );
  assert.deepEqual(
    r.rows.map((x) => `${x.canonical_service} → ${x.tile_id} (tier ${x.tier ?? 'missing'})`),
    [],
    'services filed onto something that is not a live branch',
  );
});

test('a service’s folder is its branch’s own parent', async () => {
  // Two ways to say where a service lives; they must not disagree. When they do
  // the admin studio shows it under one folder and the couple-side rollups
  // count it under the other.
  const r = await db.query<{
    canonical_service: string;
    folder_id: string;
    tile_id: string;
    parent_id: string;
  }>(
    `SELECT t.canonical_service, t.folder_id, t.tile_id, c.parent_id
       FROM canonical_service_taxonomy t
       JOIN service_categories c ON c.id = t.tile_id AND c.tier = 2
      WHERE t.folder_id IS DISTINCT FROM c.parent_id
      ORDER BY t.canonical_service`,
  );
  assert.deepEqual(
    r.rows.map((x) => `${x.canonical_service}: folder ${x.folder_id} but ${x.tile_id} hangs off ${x.parent_id}`),
    [],
    'folder_id disagrees with the branch’s parent',
  );
});

test('filing did NOT make the unsold services sellable', async () => {
  // The load-bearing half. Officiants, pre-marriage counselling and marriage
  // paperwork are deliberately not sold on the marketplace (lib/taxonomy.ts,
  // 2026-05-31 lock: the celebrant auto-resolves from the ceremony venue, the
  // paperwork lives in the Setnayan AI wizard). Filing them gave them a home in
  // the admin tree and must not have given them a shopfront.
  const branches = await db.query<{ id: string; hidden: boolean; leaves: number }>(
    `SELECT c.id,
            c.marketplace_hidden AS hidden,
            (SELECT count(*)::int FROM canonical_service_taxonomy t WHERE t.tile_id = c.id) AS leaves
       FROM service_categories c
      WHERE c.id = ANY($1::text[])`,
    [[...ADMIN_ONLY_BRANCHES]],
  );
  assert.equal(
    branches.rows.length,
    ADMIN_ONLY_BRANCHES.length,
    `expected all ${ADMIN_ONLY_BRANCHES.length} admin-only branches to exist, found ` +
      branches.rows.map((b) => b.id).join(', '),
  );
  for (const b of branches.rows) {
    assert.equal(b.hidden, true, `branch ${b.id} is no longer marketplace_hidden`);
    assert.ok(b.leaves > 0, `branch ${b.id} is empty — the services it exists for are unfiled again`);
  }

  const exposed = await db.query<{ canonical_service: string; tile_id: string }>(
    `SELECT canonical_service, tile_id
       FROM canonical_service_taxonomy
      WHERE tile_id = ANY($1::text[])
        AND coalesce(marketplace_hidden, false) = false
      ORDER BY canonical_service`,
    [[...ADMIN_ONLY_BRANCHES]],
  );
  assert.deepEqual(
    exposed.rows.map((x) => `${x.tile_id} › ${x.canonical_service}`),
    [],
    'a deliberately-unsold service is now marketplace-visible. If that is the ' +
      'intent it is an OWNER decision (it opens a supplier category), not a ' +
      'taxonomy tidy-up — change this test on purpose.',
  );
});

test('the branches that hold the unsold services hold ALL of them', async () => {
  // A floor, not a total: pinning the exact 30 would go red the moment a
  // legitimate 31st celebrant is added, and a maintainer would relax it. What
  // must never happen is the count sliding back toward zero.
  const r = await db.query<{ n: number }>(
    `SELECT count(*)::int AS n
       FROM canonical_service_taxonomy
      WHERE tile_id = ANY($1::text[])`,
    [[...ADMIN_ONLY_BRANCHES]],
  );
  assert.ok(
    (r.rows[0]?.n ?? 0) >= 30,
    `expected at least the 30 services migration 20271172444653 filed, found ${r.rows[0]?.n}`,
  );
});
