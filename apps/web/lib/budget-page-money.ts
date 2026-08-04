/**
 * budget-page-money — what `/dashboard/[eventId]/budget` PRINTS.
 * (BUD-2 · Explore_Replan_BUILD_SPEC_2026-07-27 §18.6 — "kills R1")
 *
 * ─── The defect this closes (R1, live on prod) ────────────────────────────
 * `/budget` prints three numbers over three DIFFERENT ROW SETS on one screen:
 *
 *   · the strip's "Committed"  — paid/fulfilled `orders` + `contracted`+
 *                                vendors' `total_cost_php`
 *   · the card's "Total to pay" — EVERY vendor's itemized total, whatever
 *                                their status
 *   · the vendor list          — `contracted`+ vendors only
 *
 * On prod event `044f7e64…` that renders **"Total to pay ₱80,000" eight
 * inches above "Committed ₱0"**, with the empty state *"You're still choosing
 * vendors"* underneath — because the ₱80,000 vendor is `considering`, so it
 * counts toward one headline, not the other, and its card is never rendered.
 * The couple cannot find, edit or delete the number driving their own budget.
 *
 * ─── The fix ─────────────────────────────────────────────────────────────
 * One calculator (`lib/budget-truth.ts` → `resolveEventMoney`, BUD-1) feeds
 * all three, and the vendor list widens to every vendor that CARRIES MONEY —
 * not only the contracted ones — so every peso in a headline has a card the
 * couple can open.
 *
 * The estimate does not vanish; it stops masquerading as a commitment. A
 * `considering` vendor's ₱80,000 is reported as `estimatedPhp`, labelled, and
 * kept out of `committed` / `stillOwed` (§18.5 rules 2/3).
 *
 * ─── FLAG ─────────────────────────────────────────────────────────────────
 * `enabled` is `isBudgetTruthEnabled()`, taken as a PARAMETER so this core can
 * be exercised in BOTH states inside one test process (the same injection
 * `bench-sort.ts` / `your-team.ts` use — see `flag-chokepoint-scan.test.ts`
 * property 3). Never read the env here.
 *
 * With `enabled: false` every function returns the pre-BUD-2 value, computed
 * from the legacy inputs — the page renders byte-identically to production.
 */

import type { EventMoney } from './budget-truth';
import type { BudgetLiveSummary, VendorBudgetSummary } from './budget';

/**
 * The three stats the "Current commitments" strip renders, plus the honesty
 * fields the strip needs to stop presenting an estimate as a commitment.
 */
export type BudgetStripMoney = {
  /** `events.estimated_budget_centavos` in PHP. null = no target set. */
  targetPhp: number | null;
  /** What the couple has actually AGREED to pay. */
  committedPhp: number;
  /**
   * Guesses — a `considering` vendor's headline, a listing's starting price.
   * NEVER folded into `committedPhp`. `null` when the caller has no honest
   * estimate to show (flag OFF: the legacy strip never had one).
   */
  estimatedPhp: number | null;
  /** target − committed. null when there is no target. */
  remainingPhp: number | null;
  /** §18.5 rule 4 — the ONE meaning of "over budget". */
  isOverBudget: boolean;
};

/**
 * Resolve the strip's numbers.
 *
 * Flag OFF → `legacyCommittedPhp` verbatim (paid orders + contracted vendors),
 * no estimate, remaining derived exactly as `BudgetSummaryStrip` derived it.
 * Flag ON  → the resolver's figures, with the estimate reported separately.
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
      estimatedPhp: null,
      remainingPhp: legacyTargetPhp !== null ? legacyTargetPhp - legacyCommittedPhp : null,
      isOverBudget:
        legacyTargetPhp !== null ? legacyTargetPhp - legacyCommittedPhp < 0 : false,
    };
  }

  return {
    targetPhp: money.targetPhp,
    committedPhp: money.committed,
    estimatedPhp: money.estimated,
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
 * Does this vendor carry money the couple can see in a headline?
 *
 * ⚠ Every test is `!== 0`, never `> 0` (R12): a change-order CREDIT is a
 * negative line, and a credit-only vendor is exactly the row a couple most
 * needs to be able to open.
 */
export function vendorCarriesMoney(s: VendorBudgetSummary): boolean {
  if (s.itemizedTotal !== 0) return true;
  if (s.paidTotal !== 0) return true;
  const headline = Number(s.vendor.total_cost_php ?? 0);
  if (Number.isFinite(headline) && headline !== 0) return true;
  return s.payments.length > 0;
}

/**
 * Which vendors get an itemization card.
 *
 * Flag OFF → confirmed (`contracted`+) only, exactly as today.
 * Flag ON  → confirmed OR carrying money. This is the half of R1 that the
 * arithmetic alone does not fix: a couple whose headline includes ₱80,000 must
 * have somewhere to go and change it. Order is preserved from the snapshot
 * (created_at ascending) so the list does not reshuffle when the flag flips.
 */
export function vendorsToItemize(args: {
  enabled: boolean;
  vendors: VendorBudgetSummary[];
  isConfirmed: (status: string) => boolean;
}): VendorBudgetSummary[] {
  const { enabled, vendors, isConfirmed } = args;
  return vendors.filter((s) => {
    if (isConfirmed(s.vendor.status as string)) return true;
    return enabled ? vendorCarriesMoney(s) : false;
  });
}
