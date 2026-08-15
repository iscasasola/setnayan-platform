/**
 * coverage-strip.ts — the pure engine behind the Coverage Strip v2 and the
 * folder-head summary pills on the Explore bench.
 *
 * Explore Replan PR-B (`Explore_Replan_BUILD_SPEC_2026-07-27.md` §3 PR-B ·
 * decision #5 "Coverage Strip = ICON tiles + state ring/badge + NEXT flag +
 * progress ring; urgency-ordered; in-plan categories only" · decision #8 for the
 * folder pills). Rendering lives in `shortlist-categories.tsx`; everything that
 * can be decided without a DOM lives here so it is unit-testable and so the
 * strip can never drift from the accordion's own planning clock.
 *
 * ⚠ THE BRIDGE IS MANY-TO-ONE, NOT A BIJECTION. `PlanGroup.catalogTile` is not
 * unique across `PLAN_GROUPS`: `ceremony_venue` is the catalogTile of BOTH the
 * `ceremony_venue` and `officiant` groups, and `reception` is claimed by more
 * than one group too. So `planGroupsForTile` returns an ARRAY, and urgency takes
 * the MOST urgent group among them — never "the" group, which does not exist.
 */

import { PLAN_GROUPS, type PlanGroupId } from '@/lib/wedding-plan-groups';
import {
  lockLeadDaysFor,
  timelineStatusOf,
  type TimelineStatus,
} from '@/lib/vendors-plan-budget';
import type { WeddingTile } from '@/lib/taxonomy';

/**
 * A category's coverage state on the strip. Mirrors the ⓘ legend in
 * `lib/explore-info-copy.ts` and the prototype's glyph set exactly.
 *
 * ⚠ 'picked' ("in your build") is only reachable when the surface is given
 * build-pick vendor ids. The bench page already reads `event_build_picks` for
 * the plan/budget model, so PR-B passes that set down rather than adding a
 * query; if a caller omits it, the state simply degrades to 'exploring'.
 */
/**
 * PR-H adds `'asked'` between 'picked' and 'locked'. Without it the strip is the
 * one couple surface still counting an asked category DOWN: nothing here knew
 * about a request, so a tile the couple had already acted on kept reading
 * "exploring" and kept its overdue clock — telling them to go do the thing they
 * had done. It is NOT 'locked' either: a decline on day six puts the tile
 * straight back in the queue, and painting it settled would hide that.
 */
export type CoverageState = 'empty' | 'exploring' | 'picked' | 'asked' | 'locked' | 'covered';

/** The state-glyph legend (spec §11.1). Kept beside the states it names. */
export const COVERAGE_GLYPH: Record<CoverageState, string> = {
  empty: '○',
  exploring: '◔',
  picked: '◕',
  // Half-filled and hollow-centred: further along than a build pick, and
  // deliberately NOT the solid dot that means a booking exists.
  asked: '◑',
  locked: '●',
  covered: '✓',
};

/** What one strip tile needs to know about itself. */
export type CoverageTile = {
  tile: string;
  /** Folder id + slug — the `openPlan(folder, tile, slug)` doorway (unchanged). */
  folder: string;
  slug: string;
  label: string;
  /** Considered vendors in the tile (the bench carousel length). */
  vendorCount: number;
  /** Considered vendors already contracted/paid/delivered/complete. */
  lockedCount: number;
  /** PR-H · vendors in this tile the couple has ASKED and who have not answered.
   *  Optional: a caller that never resolves it (and every pre-handshake fixture)
   *  leaves it undefined, which reads as zero — today's behaviour exactly. */
  askedCount?: number;
  /** Considered vendors pinned to the working build (`event_build_picks`). */
  buildCount: number;
  /** The couple answered "I'm done" here (slice A's `complete` decision). */
  covered: boolean;
  /** Position in the taxonomy walk — the stable final tiebreak. */
  order: number;
};

/**
 * Every plan group whose `catalogTile` is this tile. Empty for tiles finer than
 * the plan-group set (the strip then falls back to neutral urgency), several for
 * the shared tiles noted in the module header.
 */
export function planGroupsForTile(tile: string): PlanGroupId[] {
  const out: PlanGroupId[] = [];
  for (const g of PLAN_GROUPS) {
    if (g.catalogTile === (tile as WeddingTile)) out.push(g.id);
  }
  return out;
}

/** Coverage state from the counts already on `ShortlistTile` + slice A's map. */
export function coverageStateOf(t: {
  vendorCount: number;
  lockedCount: number;
  buildCount: number;
  covered: boolean;
  askedCount?: number;
}): CoverageState {
  if (t.covered) return 'covered';
  if (t.lockedCount > 0) return 'locked';
  // BELOW locked, ABOVE picked. A real booking in the tile outranks an
  // outstanding question about a different vendor in it — the same precedence
  // `lockRequestStateOf` applies row by row.
  if ((t.askedCount ?? 0) > 0) return 'asked';
  if (t.buildCount > 0) return 'picked';
  if (t.vendorCount > 0) return 'exploring';
  return 'empty';
}

/** Sort weight of a timeline status — smaller is more urgent. */
const URGENCY_RANK: Record<TimelineStatus, number> = {
  overdue: 0,
  due_soon: 1,
  start_now: 2,
  upcoming: 3,
  // PR-H · asked and unanswered. Ranked BELOW every actionable status (there is
  // nothing for the couple to do) and ABOVE 'locked' (it is not settled, and a
  // decline on day six puts it straight back in the queue).
  awaiting: 4,
  locked: 5,
};

/**
 * Where a tile sits on the planning clock: the MOST urgent status across every
 * plan group that claims it. A tile with no plan group (finer than the group
 * set) reads 'upcoming' — quiet, never a fabricated warning.
 */
export function timelineStatusForTile(
  tile: string,
  daysUntilWedding: number | null,
  state: CoverageState,
): TimelineStatus {
  const groups = planGroupsForTile(tile);
  if (groups.length === 0) {
    if (state === 'locked' || state === 'covered') return 'locked';
    return state === 'asked' ? 'awaiting' : 'upcoming';
  }
  // 'covered' and 'locked' both mean "this slot is settled" for the clock;
  // 'asked' means the clock has nothing left to ask of the couple.
  const childState: 'finalized' | 'awaiting' | 'empty' =
    state === 'locked' || state === 'covered'
      ? 'finalized'
      : state === 'asked'
        ? 'awaiting'
        : 'empty';
  let best: TimelineStatus = 'locked';
  for (const g of groups) {
    const s = timelineStatusOf(g, daysUntilWedding, childState);
    if (URGENCY_RANK[s] < URGENCY_RANK[best]) best = s;
  }
  return best;
}

/** The longest lead time among the tile's plan groups (0 when it has none). */
export function leadDaysForTile(tile: string): number {
  const groups = planGroupsForTile(tile);
  if (groups.length === 0) return 0;
  return Math.max(...groups.map(lockLeadDaysFor));
}

/**
 * Urgency-first ordering with COVERED SINKING RIGHT (spec §3 PR-B).
 *
 * Keys, in order: covered last → timeline urgency → longer lead time first (an
 * earlier lock-by floor is the more pressing decision at the same status) →
 * taxonomy order. Pure and total, so the result is stable across renders.
 */
export function orderCoverageTiles<T extends CoverageTile>(
  tiles: readonly T[],
  daysUntilWedding: number | null,
): T[] {
  return [...tiles].sort((a, b) => {
    const ac = a.covered ? 1 : 0;
    const bc = b.covered ? 1 : 0;
    if (ac !== bc) return ac - bc;
    const ar = URGENCY_RANK[timelineStatusForTile(a.tile, daysUntilWedding, coverageStateOf(a))];
    const br = URGENCY_RANK[timelineStatusForTile(b.tile, daysUntilWedding, coverageStateOf(b))];
    if (ar !== br) return ar - br;
    const al = leadDaysForTile(a.tile);
    const bl = leadDaysForTile(b.tile);
    if (al !== bl) return bl - al;
    return a.order - b.order;
  });
}

/**
 * Header numbers for the strip: "Covered X of Y" + the progress ring fraction +
 * which tile carries the NEXT flag (the first not-covered tile in the ordered
 * list). `nextTile` is null once everything is covered.
 */
export function coverageSummary(ordered: readonly CoverageTile[]): {
  covered: number;
  total: number;
  fraction: number;
  nextTile: string | null;
} {
  const total = ordered.length;
  const covered = ordered.filter((t) => t.covered).length;
  const next = ordered.find((t) => !t.covered) ?? null;
  return {
    covered,
    total,
    fraction: total === 0 ? 0 : covered / total,
    nextTile: next ? next.tile : null,
  };
}

/**
 * The badge a tile carries at the bottom-right of its icon (spec §3 PR-B "count
 * badge (locked count) and a ✓ badge for covered"). Locked wins over build so a
 * contracted vendor is never hidden behind a candidate count; no badge at all
 * when there is nothing committed.
 */
export function coverageBadgeOf(t: CoverageTile):
  | { kind: 'covered'; text: '✓' }
  | { kind: 'locked'; text: string }
  | { kind: 'asked'; text: string }
  | { kind: 'build'; text: string }
  | null {
  if (t.covered) return { kind: 'covered', text: '✓' };
  if (t.lockedCount > 0) return { kind: 'locked', text: String(t.lockedCount) };
  if ((t.askedCount ?? 0) > 0) return { kind: 'asked', text: String(t.askedCount) };
  if (t.buildCount > 0) return { kind: 'build', text: String(t.buildCount) };
  return null;
}

/**
 * Folder-head summary pills (spec §3 PR-B · decision #8): "● N locked ·
 * N to decide · ＋N more".
 *
 * Every number is computed from data the bench ALREADY has — no invented counts:
 *  • locked — considered vendors in this folder that are contracted/paid/etc.
 *  • toDecide — categories the couple PLANNED here that are neither covered nor
 *    holding a locked vendor. (Not "all categories": an unplanned tile is not a
 *    pending decision.)
 *  • more — categories in this folder that are NOT in the couple's plan, i.e.
 *    the "＋ Add to your event" pool PR-C will make interactive. Presentational
 *    here.
 * "✓ All covered" replaces the three only when the folder has planned
 * categories and none of them is still open.
 */
export type FolderSummary = {
  locked: number;
  toDecide: number;
  more: number;
  allCovered: boolean;
};

export function folderSummaryOf(tiles: readonly CoverageTile[], plannedTiles: ReadonlySet<string>): FolderSummary {
  let locked = 0;
  let toDecide = 0;
  let more = 0;
  let planned = 0;
  for (const t of tiles) {
    locked += t.lockedCount;
    if (plannedTiles.has(t.tile)) {
      planned += 1;
      if (!t.covered && t.lockedCount === 0) toDecide += 1;
    } else {
      more += 1;
    }
  }
  return { locked, toDecide, more, allCovered: planned > 0 && toDecide === 0 };
}
