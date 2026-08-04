/**
 * TILE × EVENT-TYPE FILLABILITY GUARD (test:db, migrations replayed).
 *
 * ── THE BUG THIS EXISTS FOR ─────────────────────────────────────────────────
 *
 * The taxonomy scopes event types at TWO grains, and the finer one WINS:
 *
 *   service_categories.applicable_event_types            (tier-2 TILE)
 *   canonical_service_taxonomy.applicable_event_types    (LEAF; NULL = inherit)
 *
 * The couple-facing surfaces narrow on the TILE (lib/taxonomy-filters.ts
 * `passesEventTypeFilter`, consumed by /explore, the Shortlist and the
 * onboarding picker). The vendor-facing coverage picker narrows on the RESOLVED
 * LEAF (lib/vendor-coverages.ts `getCoverageTaxonomy`: leaf override, else
 * tile, else universal) — and the SERVER enforces it (`parseEventTypes` in
 * app/vendor-dashboard/services/coverage-actions.ts).
 *
 * So when a tile claims an event type that NONE of its leaves resolve to, the
 * two halves disagree and the tile becomes unfillable BY CONSTRUCTION:
 *
 *   host sees the tile  →  no vendor can tick that event type on the coverage
 *                       →  vendor_coverages.event_types never contains it
 *                       →  syncProfileFromCoverages never puts it in
 *                          vendor_profiles.event_types
 *                       →  /explore's .contains('event_types', [type])
 *                          can never return that vendor.
 *
 * Not "empty until vendors sign up" — empty FOREVER. And it is invisible:
 * prod is pre-launch (`vendor_services` has 0 rows), so a dead shelf and a new
 * shelf render identically. This is the same failure mode as the two-vocabulary
 * trap that made all three specialization desks unreachable — a defect that
 * lives in the JOIN between two individually-correct halves, which is why
 * verifying each half found nothing.
 *
 * ── WHY THIS TEST AND NOT lib/taxonomy-tile-reachability.test.ts ────────────
 *
 * That guard is the right idea at the wrong grain: it asserts a tile has ≥1
 * canonical AT ALL, keyed off the CODE constant `TAXONOMY_MAP` — which carries
 * no event scoping whatsoever (`taxonomy-snapshot.ts` fallback ships
 * `tileEventTypes: {}`, "constant fallback has no event scoping"). The scoping
 * exists ONLY in the DB, so only a migration-replay test can see it. The two
 * guards are complementary: that one catches an empty shelf, this one catches a
 * shelf that is stocked for weddings and padlocked for everyone else.
 *
 * ── HOW THE ALLOWLIST WORKS (read before adding to it) ──────────────────────
 *
 * `KNOWN_UNFILLABLE` is asserted in BOTH directions, exactly like
 * KNOWN_DEAD_TILES:
 *   • an unfillable pair NOT allowlisted  → FAIL (a new defect)
 *   • an allowlisted pair that now fills  → FAIL (stale — delete the line)
 *
 * The second direction is the point: you cannot fix a pair and leave its entry
 * behind to re-hide the next regression. The list can only ever shrink.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';

import { createReplayedDb, type ReplayResult } from './replay-migrations';

let replay: ReplayResult;

before(async () => {
  replay = await createReplayedDb();
});

after(async () => {
  await replay?.db?.close();
});

/**
 * `tile:event_type` pairs that are unfillable as of 2026-08-01 — measured by
 * running the query below against PROD, not copied from any document.
 *
 * Each is a live defect with a real cost. DELETE the line in the same change
 * that fixes its data; this test fails until you do.
 */
const KNOWN_UNFILLABLE: Record<string, string> = {
  // ── gala_night, added 2026-07 AFTER these five leaf overrides were written.
  // The tiles were widened to gala_night; the leaves beneath them never were,
  // so every one of them is padlocked for gala hosts. One-line fix each (NULL
  // the redundant leaf override, or append gala_night to it) — deliberately not
  // bundled into the date/hangout PR that added this guard, because widening
  // another event type's reach is its own reviewable change.
  'av_production:gala_night':
    "leaf av_production is scoped ['corporate','wedding','debut']; its tile also claims gala_night.",
  'event_insurance:gala_night':
    'leaf event_insurance predates gala_night; its tile claims it.',
  'personal_accident_insurance:gala_night':
    'leaf personal_accident_insurance predates gala_night; its tile claims it.',
  'event_medic:gala_night':
    "leaf event_medic is scoped ['tournament','wedding','corporate']; its tile also claims gala_night.",
  'speaker_talent:gala_night':
    "leaf speaker_talent is scoped ['corporate']; its tile also claims gala_night.",

  // ── kids_entertainer: the tile serves birthday + christening, the leaf only
  // birthday. A christening host sees "Kids' Entertainer" and no vendor can
  // ever fill it.
  'kids_entertainer:christening':
    "leaf kids_entertainer is scoped ['birthday']; its tile also claims christening.",

  // ── editorial: ZERO canonicals — already tracked, with its owner sign-off,
  // in lib/taxonomy-tile-reachability.test.ts KNOWN_DEAD_TILES. Listed here
  // too because a zero-leaf tile is unfillable for EVERY type it claims, and
  // an unexplained silent pass would be worse than a duplicated note.
  'editorial:wedding': 'zero canonicals — see KNOWN_DEAD_TILES (owner sign-off open).',
  'editorial:debut': 'zero canonicals — see KNOWN_DEAD_TILES (owner sign-off open).',
  'editorial:corporate': 'zero canonicals — see KNOWN_DEAD_TILES (owner sign-off open).',
  'editorial:gala_night': 'zero canonicals — see KNOWN_DEAD_TILES (owner sign-off open).',

  // ── filipiniana_barongs: ZERO rows in canonical_service_taxonomy name this
  // tile — its 10 ids live under brides_attire / grooms_attire with no
  // secondary_tiles, and the marketplace only shows it because
  // lib/vendor-counts.ts HARD-CODES the cross-view. Documented as live and
  // uncaught in lib/taxonomy-tile-reachability.test.ts; this guard is the first
  // thing that actually fails on it. Needs the owner call recorded there
  // (cross-list via secondary_tiles, or drop the hard-coded cross-view).
  'filipiniana_barongs:wedding': 'zero leaves name this tile — hard-coded cross-view only.',
  'filipiniana_barongs:debut': 'zero leaves name this tile — hard-coded cross-view only.',
  'filipiniana_barongs:christening': 'zero leaves name this tile — hard-coded cross-view only.',
  'filipiniana_barongs:celebration': 'zero leaves name this tile — hard-coded cross-view only.',
  'filipiniana_barongs:anniversary': 'zero leaves name this tile — hard-coded cross-view only.',
  'filipiniana_barongs:graduation': 'zero leaves name this tile — hard-coded cross-view only.',
  'filipiniana_barongs:reunion': 'zero leaves name this tile — hard-coded cross-view only.',
  'filipiniana_barongs:gala_night': 'zero leaves name this tile — hard-coded cross-view only.',
};

/**
 * Every (visible tile, event type it claims) pair with no leaf that resolves to
 * that type. `resolved` mirrors getCoverageTaxonomy exactly: a non-empty leaf
 * override wins, else the tile's list, else NULL (universal — matches all).
 */
const UNFILLABLE_SQL = `
WITH tiles AS (
  SELECT id, applicable_event_types
    FROM public.service_categories
   WHERE tier = 2
     AND COALESCE(marketplace_hidden, false) = false
     AND COALESCE(status, 'active') <> 'retired'
     AND applicable_event_types IS NOT NULL
     AND cardinality(applicable_event_types) > 0
), leaves AS (
  SELECT c.tile_id,
         COALESCE(NULLIF(c.applicable_event_types, '{}'), t.applicable_event_types) AS resolved
    FROM public.canonical_service_taxonomy c
    JOIN tiles t ON t.id = c.tile_id
   WHERE COALESCE(c.marketplace_hidden, false) = false
), claims AS (
  SELECT id AS tile, unnest(applicable_event_types) AS event_type FROM tiles
)
SELECT claims.tile, claims.event_type
  FROM claims
 WHERE NOT EXISTS (
   SELECT 1 FROM leaves
    WHERE leaves.tile_id = claims.tile
      AND (leaves.resolved IS NULL OR claims.event_type = ANY(leaves.resolved))
 )
 ORDER BY claims.tile, claims.event_type
`;

async function unfillablePairs(): Promise<string[]> {
  const r = await replay.db.query<{ tile: string; event_type: string }>(UNFILLABLE_SQL);
  return r.rows.map((row) => `${row.tile}:${row.event_type}`);
}

test('no tile advertises an event type none of its leaves can serve', async () => {
  // Sanity: an empty/failed read must not pass as "nothing is broken". The
  // whole point of this guard is that empty and denied look identical here.
  const sane = await replay.db.query<{ n: number }>(
    `SELECT count(*)::int AS n FROM public.service_categories WHERE tier = 2`,
  );
  assert.ok(
    (sane.rows[0]?.n ?? 0) >= 50,
    `expected the full tier-2 tile roster, got ${sane.rows[0]?.n ?? 0} — the read is broken, not the data`,
  );

  const unexpected = (await unfillablePairs()).filter((k) => !(k in KNOWN_UNFILLABLE));

  assert.deepEqual(
    unexpected,
    [],
    `\n\nUNFILLABLE TILE × EVENT-TYPE PAIR(S) INTRODUCED.\n` +
      `The host sees the tile; no vendor can ever declare coverage for that event\n` +
      `type, so /explore can never return one. Empty FOREVER, with no error and\n` +
      `no empty state distinct from "nobody has signed up yet".\n\n` +
      `  ${unexpected.join('\n  ')}\n\n` +
      `Fix the DATA: either NULL the leaf's redundant applicable_event_types so it\n` +
      `inherits its tile, or append the type to the leaf. Only add to\n` +
      `KNOWN_UNFILLABLE when the dead pair is a deliberate, owner-signed state.\n`,
  );
});

test('KNOWN_UNFILLABLE is self-cleaning — a fixed pair must be removed from it', async () => {
  const live = new Set(await unfillablePairs());
  const stale = Object.keys(KNOWN_UNFILLABLE).filter((k) => !live.has(k));

  assert.deepEqual(
    stale,
    [],
    `\n\nSTALE ALLOWLIST ENTRIES — these pairs now fill fine.\n` +
      `Delete them from KNOWN_UNFILLABLE. Leaving a fixed pair allowlisted would\n` +
      `silently suppress the NEXT regression on it, which is exactly the failure\n` +
      `mode this guard exists to end.\n\n` +
      `  ${stale.join('\n  ')}\n`,
  );
});

test('travel reaches accommodation + transfers, and wedding keeps accommodation', async () => {
  // Regression pin for the travel vertical (2026-08-01). Two halves, and the
  // generic test above would catch NEITHER on its own:
  //
  //  (a) `accommodation` is the MIRROR of the date/hangout dead end. The leaf
  //      was already tagged ['travel','wedding'], so a hotel could tick Travel
  //      on its coverage — but the leaf sat on the `reception` tile (the
  //      wedding reception-VENUE shelf), which travel never reaches, so no
  //      travel host was ever shown a shelf it sits on. A leaf reachable by the
  //      vendor and invisible to the host is not an unfillable pair, so the
  //      generic query above is blind to it by construction.
  //
  //  (b) the fix must not become a wedding REGRESSION. Scoping the new tile to
  //      travel alone would silently strip wedding's access to a leaf it has
  //      today — and with prod pre-launch nobody would see it.
  const tiles = await replay.db.query<{ id: string; types: string[] | null }>(
    `SELECT id, applicable_event_types AS types
       FROM public.service_categories
      WHERE id IN ('accommodation','transfers_rentals')`,
  );
  const byId = new Map(tiles.rows.map((r) => [r.id, r.types ?? []]));
  assert.equal(byId.size, 2, 'both travel tiles must exist');
  assert.ok(byId.get('accommodation')?.includes('travel'), 'accommodation must reach travel');
  assert.ok(
    byId.get('accommodation')?.includes('wedding'),
    'accommodation must KEEP wedding — the leaf was wedding-tagged before this tile existed',
  );
  assert.ok(
    byId.get('transfers_rentals')?.includes('travel'),
    'transfers_rentals must reach travel',
  );
  assert.ok(
    !byId.get('transfers_rentals')?.includes('wedding'),
    'transfers_rentals is travel-only — an airport transfer is not a wedding service',
  );

  // The re-shelved leaf must resolve for BOTH types (getCoverageTaxonomy rules).
  const leaf = await replay.db.query<{ tile_id: string; resolved: string[] | null }>(
    `SELECT c.tile_id,
            COALESCE(NULLIF(c.applicable_event_types,'{}'), t.applicable_event_types) AS resolved
       FROM public.canonical_service_taxonomy c
       JOIN public.service_categories t ON t.id = c.tile_id
      WHERE c.canonical_service = 'accommodation'`,
  );
  assert.equal(leaf.rows[0]?.tile_id, 'accommodation', 'accommodation leaf must sit on its own tile');
  for (const t of ['travel', 'wedding']) {
    assert.ok(
      leaf.rows[0]?.resolved?.includes(t),
      `accommodation must stay declarable for ${t}; resolved = ${JSON.stringify(leaf.rows[0]?.resolved)}`,
    );
  }

  // And the shelf it left must still be stocked — an emptied tile is pruned
  // entirely, which would delete the wedding reception shelf as a side effect.
  const reception = await replay.db.query<{ n: number }>(
    `SELECT count(*)::int AS n FROM public.canonical_service_taxonomy
      WHERE tile_id = 'reception' AND COALESCE(marketplace_hidden,false) = false`,
  );
  assert.ok(
    (reception.rows[0]?.n ?? 0) >= 6,
    `reception must keep its own venues, has ${reception.rows[0]?.n}`,
  );
});

test('the date + hangout dining tile is fillable (the defect that prompted this guard)', async () => {
  // Narrow, explicit regression pin. `restaurant_reservation` is the ONLY
  // dining tile either type has: if it silently reverts to a ['travel'] leaf
  // override, both types lose their single most important category and the
  // generic test above would only say so via an allowlist diff.
  const r = await replay.db.query<{ resolved: string[] | null }>(
    `SELECT COALESCE(NULLIF(c.applicable_event_types, '{}'), t.applicable_event_types) AS resolved
       FROM public.canonical_service_taxonomy c
       JOIN public.service_categories t ON t.id = c.tile_id
      WHERE c.canonical_service = 'restaurant_reservation'`,
  );
  const resolved = r.rows[0]?.resolved ?? null;
  assert.ok(resolved, 'restaurant_reservation leaf did not resolve to any event-type list');
  for (const t of ['travel', 'date', 'hangout']) {
    assert.ok(
      resolved.includes(t),
      `restaurant_reservation must be declarable for ${t}; resolved = ${JSON.stringify(resolved)}`,
    );
  }
});
