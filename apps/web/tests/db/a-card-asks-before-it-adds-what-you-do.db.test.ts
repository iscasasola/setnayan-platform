/**
 * 🏷 A CARD IN A NEW CATEGORY ASKS ONCE, THEN ADDS IT — both answers, proved against the replayed schema.
 *
 * Owner 2026-10-14 (DECISION_LOG 🏷): on Create of a card whose kind is not in the supplier's coverage, the maker asks
 * "Add <kind> to what you do? Couples will find you there."
 *   · NOT NOW → the card saves and `vendor_coverages` / `vendor_profiles.services` are UNCHANGED. Saving a card never
 *     writes coverage: `save_vendor_service` (the card's one write) is called here exactly as commitVendorService
 *     calls it, and the two coverage tables are compared before and after.
 *   · YES → the REAL coverage write (`addCoverageForCardKind`, lib/vendor-coverage-write.ts — the same body
 *     `createCoverage` runs) adds the leaf, and the profile's `services[]` (what supplier discovery filters) gains it.
 *     Within the plan's family cap: one family too many is refused as `over_cap` and nothing is written.
 *
 * Not vacuous: every "unchanged" is measured against a count taken first, the leaves are confirmed to be live leaves
 * in different families, and the Yes path is shown to CHANGE the very rows the Not-now path leaves alone.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import type { PGlite } from '@electric-sql/pglite';
import { makeAdminClient } from './supabase-over-pglite'; // also installs the `server-only` shim
import { createReplayedDb, type ReplayResult } from './replay-migrations';
import type { CoverageParent } from '../../lib/vendor-coverages';

type Writer = typeof import('../../lib/vendor-coverage-write');

let replay: ReplayResult;
let db: PGlite;
let write: Writer;

const VP = '3a3a3a3a-3a3a-43a3-83a3-3a3a3a3a3a3a';
const CATERING = 'catering';
const PHOTO = 'photo_video';
const FLORIST = 'florist';

before(async () => {
  replay = await createReplayedDb();
  db = replay.db;
  write = await import('../../lib/vendor-coverage-write');
  await db.query(
    `INSERT INTO vendor_profiles (vendor_profile_id, business_name, verification_state, last_verified_at, services)
     VALUES ($1, 'Tita Nena Test Kitchen', 'verified', NOW(), ARRAY['catering']::text[])
     ON CONFLICT (vendor_profile_id) DO NOTHING`,
    [VP],
  );
  // The shop already covers catering — its first, covered family.
  await db.query(
    `INSERT INTO vendor_coverages (vendor_profile_id, canonical_service, event_types, faiths)
     VALUES ($1, $2, ARRAY['wedding']::text[], ARRAY[]::text[])`,
    [VP, CATERING],
  );
});
after(async () => {
  await db?.close();
});

/** The live tree for the leaves under test, in `getCoverageTaxonomy()`'s own shape. */
async function treeFor(leaves: string[]): Promise<CoverageParent[]> {
  const r = await db.query<{ canonical_service: string; folder_id: string; tile_id: string }>(
    `SELECT canonical_service, folder_id, tile_id FROM canonical_service_taxonomy WHERE canonical_service = ANY($1::text[])`,
    [`{${leaves.join(',')}}`],
  );
  const byFolder = new Map<string, CoverageParent>();
  for (const row of r.rows) {
    const p = byFolder.get(row.folder_id) ?? { folderId: row.folder_id, label: row.folder_id, branches: [] };
    p.branches.push({
      tileId: row.tile_id,
      label: row.tile_id,
      leaves: [{ canonicalService: row.canonical_service, label: row.canonical_service, allowedEventTypes: null }],
    });
    byFolder.set(row.folder_id, p);
  }
  return [...byFolder.values()];
}

async function coverageState(): Promise<{ coverages: string[]; services: string[] }> {
  const c = await db.query<{ canonical_service: string }>(
    `SELECT canonical_service FROM vendor_coverages WHERE vendor_profile_id = $1 ORDER BY canonical_service`,
    [VP],
  );
  const s = await db.query<{ services: string[] | null }>(
    `SELECT services FROM vendor_profiles WHERE vendor_profile_id = $1`,
    [VP],
  );
  return {
    coverages: c.rows.map((x) => x.canonical_service),
    services: [...(s.rows[0]?.services ?? [])].sort(),
  };
}

test('the three leaves are live leaves in THREE families (or the cap case proves nothing)', async () => {
  const tree = await treeFor([CATERING, PHOTO, FLORIST]);
  const folders = tree.map((p) => p.folderId);
  assert.equal(folders.length, 3, `expected three families, got ${JSON.stringify(folders)}`);
});

test('NOT NOW — saving a card in an uncovered kind leaves coverage and discovery untouched', async () => {
  const beforeState = await coverageState();
  assert.deepEqual(beforeState.coverages, [CATERING]);
  const admin = makeAdminClient(db);
  const { data: id, error } = await admin.rpc('save_vendor_service', {
    p_vendor_profile_id: VP,
    p_service_id: null,
    p_fields: { category: PHOTO, title: 'Photo booth corner', pricing_basis: 'fixed' },
    p_links: [],
    p_schedule: [],
    p_discounts: [],
    p_brackets: [],
    p_inclusions: [],
    p_publish: false,
  });
  assert.equal(error, null, `the card did not save: ${error?.message}`);
  assert.ok(typeof id === 'string' && id.length > 0, 'no card id came back');
  const card = await db.query<{ category: string }>(`SELECT category FROM vendor_services WHERE vendor_service_id = $1`, [id]);
  assert.equal(card.rows[0]?.category, PHOTO, 'the card was not saved under its kind');
  assert.deepEqual(await coverageState(), beforeState, 'saving the card wrote coverage — it must only ever be asked');
});

test('YES over the plan’s family cap — refused as over_cap, nothing written', async () => {
  // Catering (coverage) + the photo card (a card counts its family too) = two families already. A florist leaf would
  // be a third on a two-family plan.
  const beforeState = await coverageState();
  const res = await write.addCoverageForCardKind(makeAdminClient(db), VP, {
    leaf: FLORIST,
    tree: await treeFor([CATERING, PHOTO, FLORIST]),
    parentCategories: 2,
    eventTypes: ['wedding'],
  });
  assert.equal(res.status, 'over_cap', JSON.stringify(res));
  assert.deepEqual(await coverageState(), beforeState, 'an over-cap answer wrote coverage');
});

test('YES in a family the shop already works in is never refused by the cap', async () => {
  // The photo CARD already counts documentary, so its own leaf fits even a two-family plan that is full.
  const res = await write.addCoverageForCardKind(makeAdminClient(db), VP, {
    leaf: PHOTO,
    tree: await treeFor([CATERING, PHOTO, FLORIST]),
    parentCategories: 2,
    eventTypes: ['wedding'],
  });
  assert.equal(res.status, 'added', JSON.stringify(res));
  await db.query(`DELETE FROM vendor_coverages WHERE vendor_profile_id = $1 AND canonical_service = $2`, [VP, PHOTO]);
  await write.syncProfileFromCoverages(makeAdminClient(db), VP);
});

test('YES within the cap — the leaf joins what you do, and discovery (services[]) gains it', async () => {
  const beforeState = await coverageState();
  const res = await write.addCoverageForCardKind(makeAdminClient(db), VP, {
    leaf: PHOTO,
    tree: await treeFor([CATERING, PHOTO]),
    parentCategories: 3,
    eventTypes: ['wedding'],
  });
  assert.equal(res.status, 'added', JSON.stringify(res));
  const afterState = await coverageState();
  assert.deepEqual(afterState.coverages, [CATERING, PHOTO].sort());
  assert.ok(afterState.services.includes(PHOTO), `services[] did not gain the leaf: ${afterState.services}`);
  assert.ok(afterState.services.includes(CATERING), 'the existing entry was dropped by the sync');
  assert.notDeepEqual(afterState, beforeState, 'the Yes path changed nothing — the Not-now assertion would be vacuous');
  const row = await db.query<{ event_types: string[] }>(
    `SELECT event_types FROM vendor_coverages WHERE vendor_profile_id = $1 AND canonical_service = $2`,
    [VP, PHOTO],
  );
  assert.deepEqual(row.rows[0]?.event_types, ['wedding'], 'the new coverage has no event type to be found under');
});

test('YES a second time — "already", never a duplicate row or an error the supplier must read', async () => {
  const beforeState = await coverageState();
  const res = await write.addCoverageForCardKind(makeAdminClient(db), VP, {
    leaf: PHOTO,
    tree: await treeFor([CATERING, PHOTO]),
    parentCategories: Infinity,
    eventTypes: ['wedding'],
  });
  assert.equal(res.status, 'already');
  assert.deepEqual(await coverageState(), beforeState);
});
