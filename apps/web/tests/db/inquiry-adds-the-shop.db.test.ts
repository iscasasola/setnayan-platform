/**
 * GUARD — no service-card kind can produce a category the database refuses.
 *
 * 🔴 THE DEFECT, measured in production 2026-09-09. `event_vendors.category` is
 * the enum `vendor_category` (58 labels, NOT NULL). The value written into it
 * came straight from `vendor_services.category`, which is plain TEXT holding a
 * DIFFERENT vocabulary — a coverage LEAF, a tier-2 TILE id, or a legacy coarse
 * key. Production's two live cards are `live_band` and `host_mc`; neither is an
 * enum label. PostgREST answered `22P02` and **a rejected query in this codebase
 * is silent** — the shop simply never joined the couple's supplier list, which
 * strands the booking step later.
 *
 * 🔑 WHY THIS READS THE DATABASE AND NOT A FIXTURE. The card kinds a supplier can
 * choose come from a taxonomy ADMINS EDIT AT RUNTIME. A hand-written list of
 * expected kinds would drift exactly the way the leaf map did, and would go green
 * while drifting. This walks the replayed `canonical_service_taxonomy` and
 * `service_categories` and checks every one of them against the real enum, so the
 * day someone adds a branch with no coarse category, CI says so instead of a
 * couple silently losing a supplier.
 *
 * ⚖ `misc` IS A PASS HERE, deliberately. It is a real label, so the row lands;
 * `no-service-lands-in-misc.db.test.ts` is the file that objects to it. This one
 * asks the narrower and harder question: can the column accept the answer at all.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import type { PGlite } from '@electric-sql/pglite';
import { createReplayedDb, type ReplayResult } from './replay-migrations';

import { eventVendorCategoryForCardKind } from '../../lib/event-vendor-category';
import { VENDOR_CATEGORIES } from '../../lib/vendors';

let replay: ReplayResult;
let db: PGlite;

/** Marketplace-visible leaves with the tile they hang off — the coverage picker's own filters. */
const LEAVES_SQL = `
  SELECT c.canonical_service, c.tile_id, b.label_en AS branch
    FROM canonical_service_taxonomy c
    JOIN service_categories b ON b.id = c.tile_id AND b.tier = 2
    JOIN service_categories p ON p.id = b.parent_id AND p.tier = 1
   WHERE coalesce(c.marketplace_hidden,false) = false
     AND coalesce(b.status,'') <> 'retired' AND coalesce(b.marketplace_hidden,false) = false
     AND coalesce(p.status,'') <> 'retired' AND coalesce(p.marketplace_hidden,false) = false
`;

const TILES_SQL = `
  SELECT b.id, b.label_en AS branch
    FROM service_categories b
    JOIN service_categories p ON p.id = b.parent_id AND p.tier = 1
   WHERE b.tier = 2
     AND coalesce(b.status,'') <> 'retired' AND coalesce(b.marketplace_hidden,false) = false
     AND coalesce(p.status,'') <> 'retired' AND coalesce(p.marketplace_hidden,false) = false
`;

type LeafRow = { canonical_service: string; tile_id: string; branch: string };
type TileRow = { id: string; branch: string };

async function enumLabels(): Promise<Set<string>> {
  const r = await db.query<{ v: string }>(
    `SELECT e.enumlabel::text AS v FROM pg_enum e
       JOIN pg_type t ON t.oid = e.enumtypid WHERE t.typname = 'vendor_category'`,
  );
  return new Set(r.rows.map((x) => x.v));
}

before(async () => {
  replay = await createReplayedDb();
  db = replay.db;
});
after(async () => {
  await db.close();
});

test('META: there is a real taxonomy and a real enum to measure against', async () => {
  // Without this, every assertion below passes vacuously — the "0 offenders"
  // that means "nothing was checked".
  const leaves = await db.query<LeafRow>(LEAVES_SQL);
  const tiles = await db.query<TileRow>(TILES_SQL);
  const labels = await enumLabels();
  assert.ok(leaves.rows.length > 50, `only ${leaves.rows.length} leaves in the replayed taxonomy`);
  assert.ok(tiles.rows.length > 20, `only ${tiles.rows.length} tiles in the replayed taxonomy`);
  assert.ok(labels.size > 40, `only ${labels.size} vendor_category labels in the replayed schema`);
});

test('every marketplace-visible card kind resolves to a label the enum HAS', async () => {
  const labels = await enumLabels();
  const r = await db.query<LeafRow>(LEAVES_SQL);
  const offenders = r.rows
    .map((l) => ({ l, got: eventVendorCategoryForCardKind(l.canonical_service, l.tile_id) }))
    .filter((x) => !labels.has(x.got))
    .map((x) => `${x.l.branch} › ${x.l.canonical_service} → ${x.got}`);
  assert.deepEqual(
    offenders,
    [],
    `${offenders.length} card kind(s) would be REFUSED by event_vendors.category ` +
      `(22P02, silently — the couple just never gets the shop):\n  ${offenders.join('\n  ')}`,
  );
});

test('a card kind that IS a tile id resolves too — the `host_mc` shape', async () => {
  // Production's second card is filed under `host_mc`, which is a BRANCH, not a
  // leaf: the taxonomy map has no entry for it, so the caller can hand in no
  // tile at all. Every live branch must survive that.
  const labels = await enumLabels();
  const r = await db.query<TileRow>(TILES_SQL);
  const offenders = r.rows
    .map((t) => ({ t, got: eventVendorCategoryForCardKind(t.id, null) }))
    .filter((x) => !labels.has(x.got))
    .map((x) => `${x.t.branch} (tile_id: ${x.t.id}) → ${x.got}`);
  assert.deepEqual(
    offenders,
    [],
    `${offenders.length} branch(es) used as a card kind would be REFUSED:\n  ${offenders.join('\n  ')}`,
  );
});

test('every legacy coarse key survives untouched and exists in the enum', async () => {
  const labels = await enumLabels();
  const bad = VENDOR_CATEGORIES.filter(
    (c) => eventVendorCategoryForCardKind(c, null) !== c || !labels.has(c),
  );
  assert.deepEqual(
    bad,
    [],
    `a coarse key was re-derived or is missing from the enum:\n  ${bad.join('\n  ')}`,
  );
});

test('NEUTRALISATION: a kind the maps do not know is caught by these assertions', async () => {
  // Proves the checks measure the resolver rather than the default. If an
  // unmappable kind still produced a legal label with no complaint, the
  // "0 offenders" above would be indistinguishable from a correct result.
  const labels = await enumLabels();
  const got = eventVendorCategoryForCardKind('a_branch_nobody_has_added_yet', null);
  assert.equal(got, 'misc', 'the floor moved — the row would no longer be guaranteed to land');
  assert.ok(labels.has('misc'), 'misc is not in the enum, so even the floor would be refused');

  // And a value that is NOT a legal label must be visible to the filter above.
  assert.equal(labels.has('live_band'), false, 'the enum unexpectedly has live_band');
  assert.equal(labels.has('host_mc'), false, 'the enum unexpectedly has host_mc');
});
