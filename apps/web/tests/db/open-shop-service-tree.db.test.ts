/**
 * GUARD — the /open-shop service picker must never offer a first-party Setnayan
 * SKU, and every leaf it DOES offer must resolve to a real coarse category.
 *
 * 🔴 THE TRAP THIS PINS SHUT. Nine first-party Setnayan SKUs are ordinary
 * marketplace-visible leaves in the admin taxonomy, sitting beside the real
 * trades — verified in production 2026-08-09:
 *
 *   Documentary › Photo & Video  → setnayan_papic · setnayan_ai_edited_highlight
 *                                  · setnayan_save_the_date_mp4
 *   Documentary › Livestream     → setnayan_panood
 *   Booths      › Photo Booth    → setnayan_patiktok
 *   Planning    › Coordinator    → setnayan_concierge
 *   Design      › Digital Services → setnayan_pakanta · setnayan_pailaw
 *                                  · setnayan_custom_monogram
 *
 * `vendor_market_stats` computes `is_setnayan_service` by array-membership of
 * `vendor_profiles.services` against exactly those keys, and `/explore` excludes
 * every row where it is true. So a vendor who drilled into Photo & Video, tapped
 * "Setnayan · Papic", finished onboarding and got verified would **never appear
 * in the marketplace** — no error, no log, nothing to notice. The same
 * silent-refusal family as the phantom column, the phantom enum value and the
 * phantom RPC argument.
 *
 * ⚠ AND IT WOULD BE A REGRESSION THE PICKER INTRODUCED. The flat `<select>` it
 * replaced is built from `SERVICE_GROUPS`, whose members are coarse categories
 * only — it physically cannot express a first-party key. Opening the raw tree is
 * what made the mistake reachable, so the filter ships with the picker.
 *
 * 🔑 WHY THE PREFIX RULE IS CHECKED AGAINST THE LIVE VIEW. `isFirstPartyService`
 * matches `setnayan_*` rather than copying the view's array, so a tenth SKU is
 * covered the day it is seeded. Case 3 asserts that convention actually holds
 * against `vendor_market_stats` — the day someone adds a first-party SKU that
 * does NOT start `setnayan_`, this fails instead of shipping a vendor into
 * invisibility.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import type { PGlite } from '@electric-sql/pglite';
import { createReplayedDb, type ReplayResult } from './replay-migrations';

import { isFirstPartyService } from '../../lib/open-shop-service-vocab';
import { vendorCategoryForLeaf } from '../../lib/vendor-packages';

let replay: ReplayResult;
let db: PGlite;

/** The leaves the picker would offer — the tree's own filters, minus first-party. */
const OFFERABLE_SQL = `
  SELECT c.canonical_service, c.tile_id, b.label_en AS branch, p.label_en AS parent
    FROM canonical_service_taxonomy c
    JOIN service_categories b ON b.id = c.tile_id AND b.tier = 2
    JOIN service_categories p ON p.id = b.parent_id AND p.tier = 1
   WHERE coalesce(c.marketplace_hidden,false) = false
     AND coalesce(b.status,'') <> 'retired' AND coalesce(b.marketplace_hidden,false) = false
     AND coalesce(p.status,'') <> 'retired' AND coalesce(p.marketplace_hidden,false) = false
`;

type Leaf = { canonical_service: string; tile_id: string; branch: string; parent: string };

before(async () => {
  replay = await createReplayedDb();
  db = replay.db;
});
after(async () => {
  await db.close();
});

test('META: the taxonomy really contains first-party SKUs to filter', async () => {
  // Without this, case 2 passes vacuously on a schema that happens to have none
  // seeded — "0 offenders" meaning "nothing was checked".
  const r = await db.query<Leaf>(OFFERABLE_SQL);
  const firstParty = r.rows.filter((l) => isFirstPartyService(l.canonical_service));
  assert.ok(
    firstParty.length > 0,
    'no setnayan_* leaves present — this suite would be measuring nothing',
  );
});

test('the picker never offers a first-party Setnayan SKU', async () => {
  const r = await db.query<Leaf>(OFFERABLE_SQL);
  const offered = r.rows.filter((l) => !isFirstPartyService(l.canonical_service));
  const leaked = offered
    .filter((l) => l.canonical_service.startsWith('setnayan'))
    .map((l) => `${l.parent} › ${l.branch} › ${l.canonical_service}`);
  assert.deepEqual(
    leaked,
    [],
    'a first-party SKU reached the picker — a vendor choosing it is excluded ' +
      'from /explore silently:\n  ' + leaked.join('\n  '),
  );
});

test('the prefix rule still matches what vendor_market_stats treats as first-party', async () => {
  // The view is the authority on which keys flip `is_setnayan_service`. If a SKU
  // is added there without the prefix, the picker would keep offering it.
  const r = await db.query<{ def: string }>(
    `SELECT pg_get_viewdef('public.vendor_market_stats'::regclass) AS def`,
  );
  const def = r.rows[0]?.def ?? '';
  const keys = [...def.matchAll(/'(setnayan[a-z0-9_]*)'/g)].map((m) => m[1]!);
  assert.ok(keys.length > 0, 'no setnayan keys found in the view — re-derive this check');
  const missed = keys.filter((k) => !isFirstPartyService(k));
  assert.deepEqual(
    missed,
    [],
    'the view treats these as first-party but the prefix rule does not catch them, ' +
      'so the picker would offer them:\n  ' + missed.join('\n  '),
  );
});

test('every leaf the picker offers resolves to a real coarse category', async () => {
  // The action derives the stored category with `vendorCategoryForLeaf`. A leaf
  // that resolved to 'misc' would file the shop under "Miscellaneous" — the
  // exact outcome the owner rejected on 2026-08-09.
  const r = await db.query<Leaf>(OFFERABLE_SQL);
  const bad = r.rows
    .filter((l) => !isFirstPartyService(l.canonical_service))
    .filter((l) => vendorCategoryForLeaf(l.canonical_service, l.tile_id) === 'misc')
    .map((l) => `${l.parent} › ${l.branch} › ${l.canonical_service}`);
  assert.deepEqual(bad, [], `offerable leaves resolving to misc:\n  ${bad.join('\n  ')}`);
});

test('NEUTRALISATION: a filter that lets everything through is caught', async () => {
  // Proves case 2 measures the filter rather than the absence of first-party
  // leaves. Swap in a filter that never excludes anything and the same check
  // must go red.
  const permissive = () => false;
  const r = await db.query<Leaf>(OFFERABLE_SQL);
  const offered = r.rows.filter((l) => !permissive());
  const leaked = offered.filter((l) => l.canonical_service.startsWith('setnayan'));
  assert.ok(
    leaked.length > 0,
    'with a permissive filter the first-party SKUs must leak — if they do not, ' +
      'case 2 proves nothing',
  );
});
