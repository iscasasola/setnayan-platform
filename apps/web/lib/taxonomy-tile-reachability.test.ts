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
 * ── ALSO KNOWN, NOT CAUGHT HERE ──────────────────────────────────────────
 *
 * ✅ FIXED 2026-07-21 — `reception` used to resolve to exactly ONE canonical
 * and it was `accommodation` (lodging), so function halls, events places and
 * hotel ballrooms had to mis-tag themselves as *accommodation* to surface at
 * all. A count check could never see that. `reception_venue` + the hall
 * family now exist; `accommodation` keeps its catering cross-list. Kept in
 * this comment as the worked example of what a count check CANNOT catch.
 *
 * 🚨 `filipiniana_barongs` is the SAME BUG CLASS, still live, and this guard
 * does NOT catch it either. It reports 10 canonicals — but only because
 * `vendor-counts.ts` hard-codes `map.set('filipiniana_barongs', [...])` for
 * the cross-view. ZERO rows in `TAXONOMY_MAP` (and zero in prod
 * `canonical_service_taxonomy`) actually name that tile; all 10 ids live
 * under `brides_attire` / `grooms_attire` with no `secondary_tiles`. So the
 * marketplace shows the tile while `getCoverageTaxonomy()` prunes the branch
 * and no vendor can ever declare it — advertised to couples, denied to
 * vendors. Needs its own owner call (cross-list via `secondary_tiles`, or
 * drop the hard-coded cross-view); deliberately NOT fixed here.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { WEDDING_TILE_ORDER, TILE_PARENT } from './taxonomy';
import { canonicalServicesForTile } from './vendor-counts';

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
  const dead = WEDDING_TILE_ORDER.filter(
    (tile) => canonicalServicesForTile(tile).length === 0,
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
  const stale = Object.keys(KNOWN_DEAD_TILES).filter(
    (tile) =>
      canonicalServicesForTile(tile as (typeof WEDDING_TILE_ORDER)[number])
        .length > 0,
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
