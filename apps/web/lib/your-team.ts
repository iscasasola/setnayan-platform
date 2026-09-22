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
  /**
   * How many LOCKED suppliers have no recorded price. `lockedPhp` is a real sum
   * of the prices that exist, so a non-zero count here means the figure beside
   * it is INCOMPLETE — the tile must say so rather than present a partial sum
   * as a total.
   */
  lockedUnpriced: number;
  /** Σ of the candidate costs that are KNOWN. Never includes a guess for a null. */
  inBuildPhp: number;
  /**
   * How many candidates have no recorded price. Same contract as
   * `lockedUnpriced`: a non-zero count means `inBuildPhp` is incomplete.
   */
  inBuildUnpriced: number;
  budgetPhp: number | null;
  /**
   * estimated budget − locked − candidates (spec §3 PR-E). Positive = to spare,
   * negative = over.
   *
   * **null when the couple has set no budget**, and **null when any locked
   * supplier or candidate has no recorded price** — because a buffer is a claim
   * about what is left, and it cannot be made from a sum that is missing rows.
   * `lockedUnpriced + inBuildUnpriced` says which case, and `bufferTile` words it.
   */
  bufferPhp: number | null;
};

/**
 * Fold the rail's money inputs into the tile set.
 *
 * ⚠ UNIT MISMATCH IS THE BUG THIS CENTRALISES: the locked total arrives in
 * CENTAVOS (`PlanBudgetModel.chosenCentavos`) while candidate costs and the
 * budget arrive in whole PHP (`rolled_cost_php`, `estimated_budget_centavos/100`
 * as resolved upstream). Converting in one place is why buffer can be trusted.
 *
 * ─── 🔑 A NULL PRICE IS NOT ₱0, AND THIS IS WHERE THAT USED TO BE LOST ──────
 * This function read `candidateCostsPhp.reduce((s, c) => s + (c ?? 0), 0)`. A
 * candidate whose price nobody has recorded was therefore added as **zero**: the
 * total did not refuse and did not warn, it just came out smaller — and it is
 * the number a couple reads to decide what they can still afford. **It lied
 * rather than refusing.**
 *
 * Measured on production 2026-09-22, event 044f7e64: both locked suppliers and
 * both candidates carry `total_cost_php = NULL`, and the page printed
 * **"LOCKED ₱0"** and **"₱2,250,000 to spare"** beside **"₱26,499 paid"**.
 *
 * So: the sums here contain only prices that EXIST, the counts say how many are
 * missing, and the buffer goes null rather than pretending. This is the shape
 * `MeasuredGuests` uses in `lib/guests.ts` — a value plus a statement about
 * whether it is complete — and its rule applies unchanged: **"unknown" means we
 * do not know, NOT zero. A caller that treats it as zero has reintroduced the
 * defect.**
 *
 * ⚠ `lockedCentavos` STAYS THE MONEY SOURCE, DELIBERATELY. The locked figure is
 * summed upstream by `vendors-plan-budget.ts` (`lockedTotal`), which has the same
 * null-swallowing shape — but it feeds the accordion, the folder headers and
 * `/budget` too. Re-deriving the amount here from the caller's rows would move a
 * displayed number for reasons unrelated to honesty, so this takes a COUNT
 * instead: the figure does not change, and the screen stops presenting a partial
 * sum as a whole one. Fixing `lockedTotal` itself is its own slice, flagged and
 * not smuggled in here.
 */
export function teamMoney(args: {
  lockedCentavos: number;
  /**
   * How many locked suppliers have no recorded price. Optional and defaulting to
   * 0 so every existing caller keeps compiling and behaving identically; a
   * caller that knows passes it and its tile becomes honest.
   */
  lockedUnpricedCount?: number;
  candidateCostsPhp: ReadonlyArray<number | null>;
  budgetPhp: number | null;
}): TeamMoney {
  // ⚠ `?? 0` IS CORRECT HERE, AND IS KEPT DELIBERATELY — the asymmetry with the
  // candidate side is the whole point. `lockedCentavos` is a SUM (upstream
  // `chosenCentavos`): its absence means "no locked rows were summed", and the
  // total of nothing genuinely is zero. A candidate's `null` cost is the
  // opposite — the row EXISTS and its price is unrecorded, so zero is a claim
  // nobody made. Dropping this would also turn a runtime `undefined` into
  // `₱NaN` on screen, which informs the couple of nothing.
  const lockedPhp = Math.round((args.lockedCentavos ?? 0) / 100);
  const lockedUnpriced = Math.max(0, Math.floor(args.lockedUnpricedCount ?? 0));
  // Only the prices that exist. `null` is counted, never added.
  const known = args.candidateCostsPhp.filter((c): c is number => c != null);
  const inBuildPhp = known.reduce<number>((s, c) => s + c, 0);
  const inBuildUnpriced = args.candidateCostsPhp.length - known.length;
  const budgetPhp = args.budgetPhp;
  const anyUnpriced = lockedUnpriced + inBuildUnpriced > 0;
  return {
    lockedPhp,
    lockedUnpriced,
    inBuildPhp,
    inBuildUnpriced,
    budgetPhp,
    // A buffer is a claim about what is LEFT. It cannot be made from a sum that
    // is missing rows, so an unknown price refuses it outright.
    bufferPhp: budgetPhp == null || anyUnpriced ? null : budgetPhp - lockedPhp - inBuildPhp,
  };
}

/**
 * The Buffer tile's copy + tone. Never a bare signed number — the couple reads
 * "to spare" / "over", which is what the prototype shows.
 */
/**
 * The note that says WHY a money tile is incomplete, or `null` when it is not.
 *
 * 🔑 RETURNING `null` IS THE MECHANISM, the same one `hiddenMoreLabel` uses in
 * `lib/capped-rows.ts`: with no string there is no note, so **"0 suppliers have
 * no price" is unrepresentable** rather than merely discouraged. A tile cannot
 * accidentally announce a doubt it does not have.
 *
 * This is separate from `bufferTile`'s text because `LockTile` truncates its
 * value line and does not truncate this one — the figure stays legible and the
 * reason stays complete. It sits beside `lockedPhp` and `inBuildPhp` too, which
 * have no "text" of their own to carry it: a peso figure that is missing rows
 * must say so, or it reads as a total.
 *
 * ⚠ THE WORDING IS BORROWED, NOT INVENTED: `budget-truth.ts` already tells a
 * couple a supplier "is booked but has no price recorded yet". One vocabulary
 * for one fact — a second spelling of it reads as a second problem.
 */
export function unpricedNote(count: number): string | null {
  if (!Number.isFinite(count) || count <= 0) return null;
  const n = Math.floor(count);
  return `${n} ${n === 1 ? 'supplier has' : 'suppliers have'} no price recorded`;
}

/**
 * The "… in your build" subtotal, worded so a partial sum cannot pass as a whole
 * one.
 *
 * Three cases, because two of them used to render identically:
 *   • everything priced → `₱52,500`
 *   • some priced, some not → `₱52,500 + 2 with no price recorded`
 *   • **nothing priced at all → `No prices recorded yet`, never `₱0`**
 *
 * That last one is the live case on this couple's event, and "₱0" was a claim
 * about their build that nobody had made. A subtotal is allowed to be small; it
 * is not allowed to be a guess.
 */
export function subtotalLabel(php: number, unpriced: number): string {
  const n = Number.isFinite(unpriced) ? Math.max(0, Math.floor(unpriced)) : 0;
  const peso = `₱${Math.round(php).toLocaleString('en-PH')}`;
  if (n === 0) return peso;
  if (php === 0) return 'No prices recorded yet';
  return `${peso} + ${n} with no price recorded`;
}

export function bufferTile(
  bufferPhp: number | null,
  /**
   * `lockedUnpriced + inBuildUnpriced` from `teamMoney`. Optional and
   * defaulting to 0, so existing callers are byte-identical.
   *
   * 🔑 THIS IS WHAT REACHES THE RENDER. A log line never changed a pixel: the
   * count has to be in the words the couple reads, or the tile is back to
   * looking like a complete answer.
   */
  unpricedCount = 0,
): {
  text: string;
  tone: 'good' | 'over' | 'none';
} {
  // Order matters: "we cannot compute this" outranks "you have not set a
  // budget", because a couple who HAS set one and sees "No budget set" would
  // reasonably think their budget had been lost.
  //
  // ⚠ THE WORDS ARE SHORT ON PURPOSE. `LockTile`'s value line is `truncate`d
  // inside a half-width grid cell, so "Not knowable — 2 suppliers have no
  // price" would render as "Not knowable — 2 su…" and the reason — the part
  // that makes it actionable — would be the half that got cut. The count
  // travels beside it as an untruncated note; see `unpricedNote`.
  if (unpricedCount > 0) return { text: 'Not knowable', tone: 'none' };
  if (bufferPhp == null) return { text: 'No budget set', tone: 'none' };
  const peso = `₱${Math.abs(Math.round(bufferPhp)).toLocaleString('en-PH')}`;
  return bufferPhp >= 0
    ? { text: `${peso} to spare`, tone: 'good' }
    : { text: `${peso} over`, tone: 'over' };
}
