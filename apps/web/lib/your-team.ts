/**
 * your-team.ts — the PURE core behind the right rail's "Your team" panel
 * (`Explore_Replan_BUILD_SPEC_2026-07-27.md` §3 PR-E · §2 decision #11 ·
 * prototype `renderTeam()`).
 *
 * The panel answers three questions and nothing else:
 *   1. what is already LOCKED (contracts),
 *   2. what is IN THE BUILD and ready to lock (candidates),
 *   3. what "still needs your decision" — and in what order,
 * with the money tiles that make (1)+(2) legible against the couple's budget
 * (Locked · In build · Budget · **Buffer**).
 *
 * Everything decidable without a DOM lives here so it is unit-testable
 * (`your-team.test.ts`) and so the rail can never drift from the accordion's own
 * planning clock. Rendering lives in `_components/build-locked.tsx`, behind
 * `isExploreReplanEnabled()`.
 *
 * ⚠ NO INVENTED SIGNALS. Every input below is already resolved on the vendors
 * page for the plan/budget model — this module re-shapes, orders and subtracts;
 * it never fabricates a number the surface doesn't have.
 */

import { PLAN_GROUPS } from '@/lib/wedding-plan-groups';
import type { TimelineStatus } from '@/lib/vendors-plan-budget';

/**
 * Sort weight of a timeline status — smaller is more urgent. Mirrors the
 * Coverage Strip's ordering (`coverage-strip.ts`) deliberately: the strip and
 * the rail must agree on "what's most pressing", and the rail reads plan GROUPS
 * where the strip reads TILES, so the two can't share one call site.
 */
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

/** A category the rail may list under "Still needs your decision". */
export type TeamDecisionInput = {
  groupId: string;
  label: string;
  /** Folder slug — the `#slfold-<slug>` scroll target the bench already renders. */
  folderSlug: string;
  /** Shortlisted vendors in this category (the bench rail's length). */
  optionCount: number;
  /** Vendors pinned to the working build for this category. */
  buildCount: number;
  /** Where the category sits on the planning clock (model `timelineStatus`). */
  timelineStatus: TimelineStatus;
  /** Days until the lock-by floor; negative = overdue, null = no event date. */
  daysLeft: number | null;
  /** Already satisfied by another vendor's package (model `coveredBy`). */
  covered: boolean;
  /** Position in the model walk — the stable final tiebreak. */
  order: number;
};

/** One rendered doorway row. */
export type TeamDecisionRow = TeamDecisionInput & {
  /** Shortlist tile to deep-link to (`?tab=shortlist&open=<tile>`), or null. */
  tile: string | null;
};

/**
 * The shortlist TILE a plan group opens on the bench, or null for the entry-point
 * groups that have no catalogue tile. This is the same `catalogTile` bridge the
 * Coverage Strip uses in the other direction (`planGroupsForTile`) — a group with
 * no tile simply gets no doorway rather than a guessed one.
 */
export function deepLinkTileForGroup(groupId: string): string | null {
  const g = PLAN_GROUPS.find((p) => p.id === groupId);
  return g?.catalogTile ?? null;
}

/**
 * Is the couple in this category's action window? (quiet before it opens)
 *
 * PR-H · `'awaiting'` is deliberately NOT actionable. The couple has already
 * done the only thing this rail could ask of them; listing it under "Still needs
 * your decision" would tell them to decide something they have decided, and the
 * only person who can move it now is the supplier.
 */
function isActionable(s: TimelineStatus): boolean {
  return s === 'overdue' || s === 'due_soon' || s === 'start_now';
}

/**
 * "Still needs your decision" — the categories in the couple's plan that have no
 * lock yet, most urgent first.
 *
 * IN-PLAN, precisely (the rail has plan groups, not the bench's tile set):
 *   • the couple has ENGAGED with it — ≥1 shortlisted vendor or ≥1 build pick —
 *     or
 *   • it is in its ACTION WINDOW (start_now / due_soon / overdue), i.e. the
 *     planning clock says it is time.
 * A category is EXCLUDED when it holds a lock (it is decided) or when the model
 * marked it covered by another vendor's package (`coveredBy` — informational
 * elsewhere, but it is genuinely not an open decision).
 *
 * Order: urgency → sooner lock-by floor first → model order. Pure and total, so
 * the list never jitters between renders.
 *
 * `limit` caps the visible rows (the prototype shows 4 + "…and N more");
 * `hiddenCount` is what the caller puts in that line. limit ≤ 0 → show all.
 */
export function stillNeedsDecision(args: {
  rows: ReadonlyArray<TeamDecisionInput>;
  lockedGroupIds: ReadonlyArray<string>;
  limit?: number;
}): { rows: TeamDecisionRow[]; hiddenCount: number } {
  const locked = new Set(args.lockedGroupIds);
  const open = args.rows.filter(
    (r) =>
      !locked.has(r.groupId) &&
      !r.covered &&
      r.timelineStatus !== 'locked' &&
      (r.optionCount > 0 || r.buildCount > 0 || isActionable(r.timelineStatus)),
  );

  open.sort((a, b) => {
    const ar = URGENCY_RANK[a.timelineStatus];
    const br = URGENCY_RANK[b.timelineStatus];
    if (ar !== br) return ar - br;
    // Sooner floor first; "no date set" (null) sorts after every dated row.
    const ad = a.daysLeft ?? Number.POSITIVE_INFINITY;
    const bd = b.daysLeft ?? Number.POSITIVE_INFINITY;
    if (ad !== bd) return ad - bd;
    return a.order - b.order;
  });

  const withTile: TeamDecisionRow[] = open.map((r) => ({
    ...r,
    tile: deepLinkTileForGroup(r.groupId),
  }));
  const limit = args.limit ?? 0;
  if (limit <= 0 || withTile.length <= limit) return { rows: withTile, hiddenCount: 0 };
  return { rows: withTile.slice(0, limit), hiddenCount: withTile.length - limit };
}

/** The rail's money tiles, all in whole PHP. */
export type TeamMoney = {
  lockedPhp: number;
  inBuildPhp: number;
  budgetPhp: number | null;
  /**
   * estimated budget − locked − candidates (spec §3 PR-E). Positive = to spare,
   * negative = over. **null when the couple has set no budget** — the tile then
   * says so rather than showing a buffer computed against a zero that isn't real.
   */
  bufferPhp: number | null;
};

/**
 * Fold the rail's three money inputs into the tile set.
 *
 * ⚠ UNIT MISMATCH IS THE BUG THIS CENTRALISES: the locked total arrives in
 * CENTAVOS (`PlanBudgetModel.chosenCentavos`) while candidate costs and the
 * budget arrive in whole PHP (`rolled_cost_php`, `estimated_budget_centavos/100`
 * as resolved upstream). Converting in one place is why buffer can be trusted.
 */
export function teamMoney(args: {
  lockedCentavos: number;
  candidateCostsPhp: ReadonlyArray<number | null>;
  budgetPhp: number | null;
}): TeamMoney {
  const lockedPhp = Math.round((args.lockedCentavos ?? 0) / 100);
  const inBuildPhp = args.candidateCostsPhp.reduce<number>((s, c) => s + (c ?? 0), 0);
  const budgetPhp = args.budgetPhp;
  return {
    lockedPhp,
    inBuildPhp,
    budgetPhp,
    bufferPhp: budgetPhp == null ? null : budgetPhp - lockedPhp - inBuildPhp,
  };
}

/**
 * The Buffer tile's copy + tone. Never a bare signed number — the couple reads
 * "to spare" / "over", which is what the prototype shows.
 */
export function bufferTile(bufferPhp: number | null): {
  text: string;
  tone: 'good' | 'over' | 'none';
} {
  if (bufferPhp == null) return { text: 'No budget set', tone: 'none' };
  const peso = `₱${Math.abs(Math.round(bufferPhp)).toLocaleString('en-PH')}`;
  return bufferPhp >= 0
    ? { text: `${peso} to spare`, tone: 'good' }
    : { text: `${peso} over`, tone: 'over' };
}
