/**
 * bench-category-search.ts — how a BENCH ROW asks the shipped category search
 * to scope itself.
 *
 * ── THE BUG THIS SERVES (owner 2026-07-29) ───────────────────────────────────
 * *"clicking find more doesn't search specifically for that category. and it
 * jumps to a new page, it needs to stay on that page."*
 *
 * `CategorySearchOverlay` — the in-place, hard-scoped sheet built exactly for
 * this — has shipped since the pre-takeover accordion, and is mounted in
 * precisely ONE place (`plan-budget-accordion.tsx`). When the new bench was
 * built its rail-end card kept the old `/explore?tile=` jump and the overlay was
 * never wired in. Nothing new is being invented here; a doorway is being
 * connected to the room that already exists.
 *
 * ── WHY A RESOLVER RATHER THAN A ONE-LINER ───────────────────────────────────
 * The accordion is built from PLAN GROUPS, so it hands the overlay a `groupId`
 * and is done. **The bench is built from TILES**, and the two do not line up:
 *
 *   • only **22 of the 69** wedding tiles are the `catalogTile` of any plan
 *     group (`planGroupsForTile` is empty for the other 47 — brides' attire,
 *     food carts, henna, event insurance, …). Those 47 render as bench rows
 *     today, so "use the group or fall back to the jump" would leave the
 *     owner's complaint standing on two thirds of the surface.
 *   • two tiles are the catalogTile of TWO groups, and the second one is
 *     narrower than the row: `reception` → `reception_venue` **and**
 *     `accommodation`; `ceremony_venue` → `ceremony_venue` **and** `officiant`.
 *     A row labelled "Reception" must not search hotels.
 *
 * So the scope carries BOTH keys, and they do different jobs:
 *
 *   • **the TILE decides WHAT is searched.** It is the row the couple tapped —
 *     never wider, never narrower. This matters beyond coverage: for 13 of the
 *     22 mapped tiles the group's `subcategoryHint` collapses the scope to a
 *     single canonical service, so scoping by group would search 1 of
 *     "Coordinator"'s 12 canonicals, 1 of "Catering"'s 5, 1 of "Hair &
 *     makeup"'s 6. A row showing a fraction of itself reads as a broken search.
 *   • **the GROUP carries CONTEXT** the tile cannot: it is the key the
 *     last-minute config (`planning_deadlines.ref_key`) and the Budget-Planner
 *     allocation leaf are stored under. Both fail open on a miss, so sending
 *     `''` costs nothing but the nudge.
 */

import { PLAN_GROUPS, type PlanGroupId } from './wedding-plan-groups';
import { planGroupsForTile } from './coverage-strip';

/** What `searchCategoryVendors` needs to hard-scope a bench row's search. */
export type BenchSearchScope = {
  /**
   * The plan group this row searches as, or `''` when the tile is finer than
   * every plan group. Empty is NOT a failure — the action falls through to
   * `tile`; it only means there is no group-keyed budget / last-minute context.
   */
  groupId: PlanGroupId | '';
  /** Always set. The row's own tile — the narrowest honest scope there is. */
  tile: string;
};

/**
 * The plan group a bench tile row should search as, or `null` when the tile is
 * finer than every plan group.
 *
 * Where a tile maps to more than one group, the group that scopes **tile-wide**
 * wins — that is, the one with no `subcategoryHint`, since a hint narrows
 * `canonicalsForGroup` to a single canonical service. This is what keeps
 * "Reception" off `accommodation` and "Ceremony venue" off `officiant`.
 */
export function benchSearchGroupForTile(tile: string): PlanGroupId | null {
  const groups = planGroupsForTile(tile);
  if (groups.length === 0) return null;
  const tileWide = groups.find(
    (id) => !PLAN_GROUPS.find((g) => g.id === id)?.subcategoryHint,
  );
  return tileWide ?? groups[0] ?? null;
}

/**
 * The scope for one bench row. Total by construction — **every** tile can open
 * the in-place overlay, so no bench row is ever left navigating away.
 */
export function benchSearchScopeForTile(tile: string): BenchSearchScope {
  return { groupId: benchSearchGroupForTile(tile) ?? '', tile };
}
