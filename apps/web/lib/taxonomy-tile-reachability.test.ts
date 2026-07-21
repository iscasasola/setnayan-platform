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
 * `reception` resolves to exactly ONE canonical and it is `accommodation`
 * (lodging — owner directive 2026-05-22). It is therefore non-empty and this
 * guard passes it, but it is semantically wrong: function halls, events
 * places and hotel ballrooms have to mis-tag themselves as *accommodation*
 * to surface at all. A count check cannot see that. It is tracked in the expo
 * verdict as canonical `reception_venue`, and is deliberately NOT encoded
 * here — pinning an exact canonical set would fail on every legitimate edit
 * and teach the next reader to ignore this file.
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
  // 🚨 The headline defect. Catholic-majority market, wedding platform, and
  // churches / chapels / garden + beach ceremony sites cannot appear at all.
  // Venue is also the most-shopped category and the Enterprise-tier buyer.
  // Fix: seed `ceremony_venue_booking` (expo verdict § the-8, item 2).
  ceremony_venue:
    'Zero canonicals since inception — no church/chapel/garden ceremony site can surface. Fix = seed ceremony_venue_booking.',

  // Documentary › Editorial. The "editorial" shoot concept has a tile and no
  // service behind it. Lower blast radius than ceremony_venue (couples reach
  // photographers through `photography`), but the tile still advertises a
  // shelf that can never stock.
  editorial:
    'Zero canonicals — tile advertises an editorial shoot with no canonical service behind it. Needs an owner call on the exact leaf before seeding.',
};

test('every marketplace tile resolves to at least one canonical service', () => {
  const dead: string[] = [];

  for (const tile of WEDDING_TILE_ORDER) {
    if (canonicalServicesForTile(tile).length === 0) {
      dead.push(`${tile} (parent: ${TILE_PARENT[tile]})`);
    }
  }

  const unexpected = dead.filter(
    (entry) => !(entry.split(' ')[0] in KNOWN_DEAD_TILES),
  );

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
