/**
 * budget-page-money — what `/dashboard/[eventId]/budget` PRINTS.
 * (BUD-2 · Explore_Replan_BUILD_SPEC_2026-07-27 §18.6 — "kills R1")
 *
 * ─── The defect this closes (R1, live on prod) ────────────────────────────
 * `/budget` printed three numbers over three DIFFERENT ROW SETS on one screen:
 *
 *   · the strip's "Committed"  — paid/fulfilled `orders` + `contracted`+
 *                                vendors' `total_cost_php`
 *   · the card's "Total to pay" — EVERY vendor's itemized total, whatever
 *                                their status
 *   · the vendor list          — `contracted`+ vendors only
 *
 * On prod event `044f7e64…` that rendered **"Total to pay ₱80,000" eight
 * inches above "Committed ₱0"**, with the empty state *"You're still choosing
 * vendors"* underneath — because the ₱80,000 vendor is `considering`, so it
 * counted toward one headline, not the other, and its card was never rendered.
 *
 * ─── The fix ─────────────────────────────────────────────────────────────
 * One calculator (`lib/budget-truth.ts` → `resolveEventMoney`, BUD-1) feeds
 * every headline on the page, so the three row sets became one.
 *
 * ─── BA2 · NO QUOTES ON THIS PAGE (owner ruling 2026-09-02) ───────────────
 * Owner, verbatim: *"no quotes here. we only add the finalized budgets. on the
 * marketplace, this is where they can add and subtract the other vendors to
 * help them find the better option for them."*
 *
 * BUD-2 answered R1 by WIDENING this page — a `considering` vendor's ₱80,000
 * got a card, and the strip named it as an estimate — so that every peso in a
 * headline was reachable. The owner has since chosen the other resolution:
 * `/budget` shows FINALIZED money only, and comparing candidates is the
 * Merkado's job. So the page NARROWS instead:
 *
 *   · `vendorsToItemize` is `contracted`+ again — an unconfirmed supplier gets
 *     no card here, whatever money it carries;
 *   · `BudgetStripMoney` has no estimate field, so the strip cannot print
 *     *"₱X more is still an estimate"*.
 *
 * ⚠ THIS DOES NOT BREAK §18.5 RULE 3 ("an estimate must not vanish"). That
 * rule's PREMISE is that un-booked vendors are listed on this page: a couple
 * reading ₱0 committed beside an ₱80,000 vendor in their own list is a
 * contradiction, so the ₱80,000 had to be named. Remove the vendor and the
 * premise goes with it — there is no ₱0-next-to-₱80,000 left to explain. The
 * estimate has not been hidden; it is shown where the couple is actually
 * choosing, in the Merkado.
 *
 * ⚠ `resolveEventMoney` is UNCHANGED. `EventMoney.estimated` and
 * `MoneyBucket.estimatedPhp` are still computed and still read — by the
 * Merkado lens's siblings and by the checklist. They simply stop reaching this
 * page. This is a display rule, not arithmetic.
 *
 * ─── FLAG ─────────────────────────────────────────────────────────────────
 * `enabled` is `isBudgetTruthEnabled()` (ON in Vercel Production since
 * 2026-09-02), taken as a PARAMETER so this core can be exercised in BOTH
 * states inside one test process (the same injection `bench-sort.ts` /
 * `your-team.ts` use — see `flag-chokepoint-scan.test.ts` property 3). Never
 * read the env here.
 *
 * `vendorsToItemize` no longer takes the flag at all: "confirmed only" is what
 * BOTH states now render, so a parameter that changes nothing would be a
 * second story about one fact.
 */

import type { EventMoney } from './budget-truth';
import type { BudgetLiveSummary, VendorBudgetSummary } from './budget';

/**
 * The three stats the "Current commitments" strip renders.
 *
 * ⚠ There is deliberately NO estimate field (BA2). A quote is not this page's
 * to print, and a field that exists only to be ignored is how the two-mechanism
 * defect starts.
 */
export type BudgetStripMoney = {
  /** `events.estimated_budget_centavos` in PHP. null = no target set. */
  targetPhp: number | null;
  /** What the couple has actually AGREED to pay. */
  committedPhp: number;
  /** target − committed. null when there is no target. */
  remainingPhp: number | null;
  /** §18.5 rule 4 — the ONE meaning of "over budget". */
  isOverBudget: boolean;
};

/**
 * Resolve the strip's numbers.
 *
 * Flag OFF → `legacyCommittedPhp` verbatim (paid orders + contracted vendors),
 * remaining derived exactly as `BudgetSummaryStrip` derived it.
 * Flag ON  → the resolver's figures.
 *
 * Both states print FINALIZED money and nothing else (BA2).
 */
export function budgetStripMoney(args: {
  enabled: boolean;
  money: EventMoney | null;
  legacyCommittedPhp: number;
  targetCentavos: number | null;
}): BudgetStripMoney {
  const { enabled, money, legacyCommittedPhp, targetCentavos } = args;
  const legacyTargetPhp = targetCentavos !== null ? targetCentavos / 100 : null;

  // `money` is null whenever the resolver was not called OR it threw — the
  // page degrades to the legacy figures rather than printing ₱0, because a
  // confident zero is the one failure mode a budget page must never have.
  if (!enabled || !money) {
    return {
      targetPhp: legacyTargetPhp,
      committedPhp: legacyCommittedPhp,
      remainingPhp: legacyTargetPhp !== null ? legacyTargetPhp - legacyCommittedPhp : null,
      isOverBudget:
        legacyTargetPhp !== null ? legacyTargetPhp - legacyCommittedPhp < 0 : false,
    };
  }

  return {
    targetPhp: money.targetPhp,
    committedPhp: money.committed,
    remainingPhp: money.targetPhp !== null ? money.targetPhp - money.committed : null,
    isOverBudget: money.isOverBudget,
  };
}

/**
 * Resolve the live payment-progress card.
 *
 * Flag OFF → `legacy` verbatim (`buildBudgetLiveSummary(snapshot)`).
 * Flag ON  → the card's headline becomes the SAME `committed` the strip shows,
 * `paid` and `remaining` come from the resolver's reconciled split, and
 * `percentPaid` is recomputed against the new base. `upcoming` is untouched:
 * it lists dated line-item milestones, which the resolver does not model and
 * which are orthogonal to the totals.
 *
 * ⚠ `remaining` is `stillOwed`, NOT `committed − paid`. They differ whenever a
 * vendor is overpaid — the resolver floors per vendor and reports the excess
 * as `overpaid` (R11), so a ₱5,000 overpayment on one vendor can no longer
 * silently cancel ₱5,000 still owed on another.
 *
 * ⚠ BA2: this core is the ONLY way a couple-facing surface may turn a snapshot
 * into payment progress — including the Realtime refetch in `budget/actions.ts`.
 * The legacy `budget` is every vendor's itemized total WHATEVER THEIR STATUS,
 * so a surface that returns it directly puts an unconfirmed supplier's quote
 * back on the page the moment the card refreshes.
 */
export function budgetLiveSummaryMoney(args: {
  enabled: boolean;
  money: EventMoney | null;
  legacy: BudgetLiveSummary;
}): BudgetLiveSummary {
  const { enabled, money, legacy } = args;
  if (!enabled || !money) return legacy;

  const budget = money.committed;
  const paid = money.paid;
  return {
    budget,
    paid,
    remaining: money.stillOwed,
    percentPaid: budget > 0 ? Math.min(100, Math.round((paid / budget) * 100)) : 0,
    upcoming: legacy.upcoming,
  };
}

/**
 * Which vendors get an itemization card on `/budget`.
 *
 * CONFIRMED ONLY — `contracted` and beyond (BA2, owner ruling 2026-09-02).
 * Money alone does not earn a card here: a shortlisted supplier carrying a
 * ₱80,000 quote is still being shopped, and shopping happens in the Merkado.
 *
 * ⚠ `isConfirmed` reads the vendor's STATUS, never whether it is on the
 * platform. `marketplace_vendor_id IS NULL` says a supplier is off-platform;
 * it says nothing about whether the money is agreed. A manually-added vendor
 * sitting at `shortlisted` is a quote, and a manually-added vendor at
 * `contracted` is a commitment.
 *
 * Order is preserved from the snapshot (created_at ascending).
 */
export function vendorsToItemize(args: {
  vendors: VendorBudgetSummary[];
  isConfirmed: (status: string) => boolean;
}): VendorBudgetSummary[] {
  const { vendors, isConfirmed } = args;
  return vendors.filter((s) => isConfirmed(s.vendor.status as string));
}
