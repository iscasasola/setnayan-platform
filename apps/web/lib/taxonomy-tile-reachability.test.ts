/**
 * TILE REACHABILITY GUARD — the durable half of the taxonomy dead-tile fix
 * (`Taxonomy_Expo_Gap_Verdict_2026-07-21.md` · `Vendor_Onboarding_Redesign_
 * Verdict_2026-07-21.md` PR 3).
 *
 * WHY THIS EXISTS — a zero-canonical tile is a SILENTLY EMPTY SHELF.
 *
 * The marketplace resolves tile → canonicals → vendors, and short-circuits:
 *
 *     const canonicals = groupCanonicals.filter(…);
 *     if (canonicals.length === 0) return EMPTY;
 *       — dashboard/[eventId]/vendors/_actions/category-search.ts
 *
 * There is no error, no log and no empty-state distinct from "nobody has
 * signed up yet". A tile with zero canonicals renders exactly like a tile
 * with plenty of canonicals and no vendors. So the defect is invisible in
 * code review, invisible in staging, and visible in production only as a
 * whole trade that couples can never find and vendors are never booked from.
 *
 * `getCoverageTaxonomy()` makes it worse in the other direction: it prunes
 * empty branches (`if (!leaves.length) continue`), so a zero-canonical tile
 * does not merely render empty in the vendor-side picker — it DOES NOT EXIST
 * there. Half the app advertises the tile; the other half denies it.
 *
 * THIS CLASS OF BUG HAS NOW SHIPPED THREE TIMES. Hence a test rather than a
 * fix: the fix is data (owner-gated — seeding canonicals is sign-off #1 of
 * the expo verdict), the guard is code, and the guard is what stops the
 * fourth instance.
 *
 * ── HOW THE ALLOWLIST WORKS (read before adding to it) ───────────────────
 *
 * `KNOWN_DEAD_TILES` is SELF-CLEANING and asserted in BOTH directions:
 *
 *   • a tile with zero canonicals that is NOT allowlisted  → FAIL (new bug)
 *   • a tile that IS allowlisted but now resolves fine     → FAIL (stale)
 *
 * The second direction is the point. It means you cannot fix a dead tile and
 * leave its entry behind to quietly re-hide the next regression on that same
 * tile — fixing the data forces you to delete the line, and the allowlist can
 * only ever shrink. Adding a line is a deliberate, reviewed act that records
 * a known-broken shelf; it is not a way to make this test go green.
 *
 * ── NO-OVERRIDE RULE (added 2026-07-21 — read this before "fixing" a tile) ─
 *
 * A count check is only as honest as the thing it counts. `filipiniana_barongs`
 * passed this guard for months while being stone dead: `vendor-counts.ts`
 * hard-coded `map.set('filipiniana_barongs', […])`, so the tile REPORTED 10
 * canonicals while ZERO rows in `TAXONOMY_MAP` (and zero in prod
 * `canonical_service_taxonomy`) named it. The marketplace advertised the tile
 * and `getCoverageTaxonomy()` pruned the branch — advertised to couples,
 * undeclarable by vendors — and the guard called it healthy.
 *
 * So the guard now checks TWO things, and the second is the one that matters:
 *
 *   1. every tile resolves to ≥1 canonical  (the original count check), and
 *   2. that count is DERIVED FROM `TAXONOMY_MAP` and nothing else — the test
 *      re-derives the tile→canonicals mapping from the raw data (primary
 *      `tile` + `secondary_tiles`, minus `marketplaceHidden`) and asserts it
 *      equals `canonicalServicesForTile()` exactly, tile by tile.
 *
 * Rule (2) makes an injection un-writable: any `map.set` / spread / special
 * case in `vendor-counts.ts` that adds a canonical the taxonomy does not
 * declare fails the parity test, and any that REMOVES one fails it too. A dead
 * tile can now only be made to pass by giving it real canonicals.
 *
 * ── ALSO KNOWN, NOT CAUGHT HERE ──────────────────────────────────────────
 *
 * ✅ FIXED 2026-07-21 — `reception` used to resolve to exactly ONE canonical
 * and it was `accommodation` (lodging), so function halls, events places and
 * hotel ballrooms had to mis-tag themselves as *accommodation* to surface at
 * all. A count check could never see that — a tile can be alive by count and
 * semantically wrong. `reception_venue` + the hall family now exist;
 * `accommodation` keeps its catering cross-list. Kept as the worked example of
 * what neither of the two checks above can catch: only a human reading the
 * leaf names can.
 *
 * ⚠ AND NEITHER CHECK SEES PROD. Both read `TAXONOMY_MAP` (compiled TS).
 * `/explore` and category-search resolve tiles from `canonical_service_taxonomy`
 * via `getCanonicalBuckets()`, so a tile is only really alive once its
 * migration is PUSHED. A green run here means "the code is right", never "prod
 * is fixed". There is no CI check for the DB half — see the deployment note in
 * the PR body.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  WEDDING_TILE_ORDER,
  TILE_PARENT,
  TAXONOMY_MAP,
  FILIPINIANA_BARONG_CANONICALS,
  WEDDING_FAITH_KEYS,
  type WeddingTile,
} from './taxonomy';
import { canonicalServicesForTile } from './vendor-counts';

/**
 * Re-derive tile → canonicals straight from `TAXONOMY_MAP`, independently of
 * `vendor-counts.ts`. This is the "second opinion" that makes an override
 * impossible to hide behind: it knows only what the taxonomy DECLARES.
 */
function canonicalsByTileFromData(): Map<string, string[]> {
  const byTile = new Map<string, string[]>();
  const add = (tile: string, canonical: string) => {
    const arr = byTile.get(tile) ?? [];
    if (!arr.includes(canonical)) arr.push(canonical);
    byTile.set(tile, arr);
  };
  for (const [canonical, meta] of Object.entries(TAXONOMY_MAP)) {
    if (meta.marketplaceHidden || !meta.tile) continue;
    add(meta.tile, canonical);
    for (const secondary of meta.secondary_tiles ?? []) {
      if (secondary !== meta.tile) add(secondary, canonical);
    }
  }
  return byTile;
}

/**
 * Tiles that resolve to ZERO canonicals today — measured against
 * `TAXONOMY_MAP` on 2026-07-21, not copied from a document.
 *
 * Each entry is a live defect with a known owner. DELETE the line in the same
 * change that seeds its canonicals; this test will fail until you do.
 */
const KNOWN_DEAD_TILES: Record<string, string> = {
  // Documentary › Editorial. STILL DEAD ON PURPOSE.
  //
  // The owner defined the CATEGORY on 2026-07-21 — magazines and content
  // companies a couple hires and pays directly, explicitly NOT photographers
  // ("editorials are not photographers, these are companies that create
  // content for weddings") — but not its GRAIN.
  // `Editorial_and_Content_Creator_Coverage_2026-07-21.md` §7 #1 is the open
  // sign-off: ONE canonical with facets, or TWO
  // (`wedding_editorial_feature` + `content_creation_team`)? §6 of that doc
  // says in terms: "Do not seed until it is made; a canonical is cheap to add
  // and awkward to remove." The verbatim follow-up "couple requests from
  // magazine, or content creators" reads like two, but the doc quotes that
  // same line and still leaves the question open — so it is not a resolution.
  //
  // This line comes out in the follow-up PR that seeds the answer.
  editorial:
    'Zero canonicals. Category is owner-defined (editorial/content companies, not photographers) but the GRAIN is an open sign-off — Editorial_and_Content_Creator_Coverage_2026-07-21.md §7 #1: one canonical with facets, or two. Do not seed ahead of it.',
};

test('every marketplace tile resolves to at least one canonical service', () => {
  // Keep the tile id alongside its rendered label — re-deriving the id by
  // splitting the label back apart is both fragile and, under
  // `noUncheckedIndexedAccess`, not even well-typed.
  // Measured against the DATA, not against vendor-counts' output — a
  // hard-coded injection there must not be able to answer this question.
  const fromData = canonicalsByTileFromData();
  const dead = WEDDING_TILE_ORDER.filter(
    (tile) => (fromData.get(tile) ?? []).length === 0,
  );

  const unexpected = dead
    .filter((tile) => !(tile in KNOWN_DEAD_TILES))
    .map((tile) => `${tile} (parent: ${TILE_PARENT[tile]})`);

  assert.deepEqual(
    unexpected,
    [],
    `\n\nDEAD TILE(S) INTRODUCED — these render as a silently empty shelf.\n` +
      `Marketplace search short-circuits on zero canonicals (category-search.ts)\n` +
      `and the vendor-side picker prunes the branch entirely, so nobody sees an\n` +
      `error — the trade simply becomes unfindable.\n\n` +
      `  ${unexpected.join('\n  ')}\n\n` +
      `Fix the data (add canonicals to TAXONOMY_MAP for these tiles). Only add\n` +
      `to KNOWN_DEAD_TILES if the emptiness is a deliberate, owner-signed state.\n`,
  );
});

test('KNOWN_DEAD_TILES is self-cleaning — a fixed tile must be removed from it', () => {
  const fromData = canonicalsByTileFromData();
  const stale = Object.keys(KNOWN_DEAD_TILES).filter(
    (tile) => (fromData.get(tile) ?? []).length > 0,
  );

  assert.deepEqual(
    stale,
    [],
    `\n\nSTALE ALLOWLIST ENTRIES — these tiles now resolve fine.\n` +
      `Delete them from KNOWN_DEAD_TILES. Leaving a fixed tile allowlisted would\n` +
      `silently suppress the NEXT regression on that same tile, which is exactly\n` +
      `the failure mode this guard exists to end.\n\n` +
      `  ${stale.join('\n  ')}\n`,
  );
});

test('every allowlisted tile is a real tile (typo guard)', () => {
  // A misspelled key would sit in the allowlist forever, suppressing nothing
  // and protecting nothing, while reading as if the defect were tracked.
  const known = new Set<string>(WEDDING_TILE_ORDER);
  const bogus = Object.keys(KNOWN_DEAD_TILES).filter((t) => !known.has(t));

  assert.deepEqual(
    bogus,
    [],
    `KNOWN_DEAD_TILES names tiles that do not exist in WEDDING_TILE_ORDER: ${bogus.join(', ')}`,
  );
});

test('tile canonicals come from the taxonomy — no hard-coded override may inject them', () => {
  // THE ANTI-OVERRIDE CHECK. `canonicalServicesForTile()` is what the app
  // asks; `canonicalsByTileFromData()` is what the taxonomy declares. If a
  // future edit re-adds `map.set('some_tile', […])` — or drops a legitimate
  // cross-listing — the two disagree here and this fails, so a dead tile can
  // never again be made to LOOK alive.
  const fromData = canonicalsByTileFromData();
  const mismatches: string[] = [];

  const tiles = new Set<string>([...WEDDING_TILE_ORDER, ...fromData.keys()]);
  for (const tile of tiles) {
    const declared = [...(fromData.get(tile) ?? [])].sort();
    const served = [...canonicalServicesForTile(tile as WeddingTile)].sort();
    const injected = served.filter((c) => !declared.includes(c));
    const dropped = declared.filter((c) => !served.includes(c));
    if (injected.length || dropped.length) {
      mismatches.push(
        `${tile}: injected=[${injected.join(', ')}] dropped=[${dropped.join(', ')}]`,
      );
    }
  }

  assert.deepEqual(
    mismatches,
    [],
    `\n\nTILE CANONICALS DIVERGE FROM THE TAXONOMY.\n` +
      `"injected" = vendor-counts.ts serves a canonical the taxonomy never declared\n` +
      `  for that tile — i.e. a hard-coded override faking a live shelf. This is\n` +
      `  exactly how filipiniana_barongs stayed dead for months while the\n` +
      `  reachability count read 10. Declare it via tile / secondary_tiles instead.\n` +
      `"dropped" = the taxonomy declares a canonical that never reaches the tile.\n\n` +
      `  ${mismatches.join('\n  ')}\n`,
  );
});

test('the Filipiniana & Barongs cross-view is declared as data, not injected', () => {
  // Regression lock on the specific defect: the tile must resolve to exactly
  // the documented cross-view set, and it must do so through secondary_tiles.
  const fromData = canonicalsByTileFromData();
  assert.deepEqual(
    [...(fromData.get('filipiniana_barongs') ?? [])].sort(),
    [...FILIPINIANA_BARONG_CANONICALS].sort(),
    'filipiniana_barongs must resolve from TAXONOMY_MAP secondary_tiles alone',
  );

  // …and the 10 keep their primary attire tile — a cross-view re-homes nothing.
  for (const canonical of FILIPINIANA_BARONG_CANONICALS) {
    const meta = TAXONOMY_MAP[canonical];
    assert.ok(meta, `${canonical} missing from TAXONOMY_MAP`);
    assert.ok(
      meta.tile === 'brides_attire' || meta.tile === 'grooms_attire',
      `${canonical} must keep its primary attire tile (got ${String(meta.tile)})`,
    );
  }
});

test('every ceremony_venue faith tag is a real faith key, one room per faith', () => {
  // The parity claim PR #3477 made and missed by one (`Chinese`). Asserted
  // here so the next faith added to WEDDING_FAITH_KEYS fails until it gets a
  // room — the DB half is asserted by migration 20270830324110 §4(d).
  const rooms = Object.entries(TAXONOMY_MAP).filter(
    ([, meta]) => meta.tile === 'ceremony_venue',
  );
  const tagged = new Set<string>(
    rooms.flatMap(([, meta]) => (meta.faith ? [meta.faith as string] : [])),
  );

  const missing = WEDDING_FAITH_KEYS.filter((f) => !tagged.has(f));
  assert.deepEqual(
    missing,
    [],
    `Faith keys with no ceremony_venue room: ${missing.join(', ')}`,
  );

  // The faith-NULL anchor must survive: passesFaithFilter is include-only, so
  // without it an untagged/non-wedding context sees an empty shelf.
  assert.ok(
    rooms.some(([, meta]) => meta.faith == null),
    'ceremony_venue lost its faith-NULL anchor (ceremony_venue_booking)',
  );
});
