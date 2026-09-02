/**
 * budget-ledger — where the couple's PLAN and their LEDGER finally meet.
 * (BA3 · Explore_Replan_BUILD_SPEC_2026-07-27 §18.5)
 *
 * ── The defect this closes ──────────────────────────────────────────────────
 * Both halves of the answer already shipped, and neither could see the other:
 *
 *   · `EventMoney.byBucket` (`lib/budget-truth.ts`) has computed, per plan
 *     group, `committedPhp · paidPhp · stillOwedPhp · overpaidPhp ·
 *     estimatedPhp · hasBenchmark · benchmarkPhp · due` on EVERY budget page
 *     load — and outside tests and `scripts/budget-parity.ts` it had **zero
 *     readers**. It was computed and thrown away.
 *   · `computeBudgetOverspend` (`lib/budget-overspend.ts`) is caller-agnostic
 *     by design, and its only caller passed the couple's SLIDER as `actualPhp`
 *     — so the one surface that could say "you signed for more than you
 *     planned" was instead saying "you dragged a slider past a suggestion".
 *
 * A couple could plan ₱450,000 for catering, sign a ₱480,000 caterer, and read
 * nothing anywhere that put those two numbers in the same sentence.
 *
 * ── The four columns, and why their names are load-bearing ──────────────────
 * Owner-locked. The couple misread the old labels, which is why they now read:
 *
 *   Planned  — what you budgeted
 *   Agreed   — what you signed for
 *   Paid     — handed over so far
 *   Owed     — agreed minus paid
 *
 * `BUDGET_LEDGER_COLUMNS` is the ONE place they are spelled. Abbreviating
 * "Agreed" to "Agr." or swapping Paid and Owed is what the guard in
 * `the-plan-meets-the-ledger.test.ts` exists to refuse.
 *
 * ── §18.5 rule 5 · unknown is unknown, never ₱0 ─────────────────────────────
 * 13 of the 27 active benchmark leaves carry a NULL `benchmark_php` in
 * production (measured 2026-09-03) — Cake among them — and real money lands in
 * them anyway: prod event `947e7bab…` has ₱30,000 agreed on Cake, ₱45,000 on
 * Cocktail Booths and ₱22,000 on Photobooth, all against no seeded price at
 * all. So `plannedPhp` is `null`, never `0`, whenever nothing can price the
 * leaf, and `unplanned` says so out loud. **A zero planned figure is not
 * representable here**: `plannedFrom()` folds 0 to null, so the rule holds
 * structurally rather than by everyone remembering it.
 *
 * ── Where "Planned" comes from, and why the row says which ──────────────────
 * Two sources, in order:
 *
 *   1 · `'saved'`     — the couple's own saved plan (the latest
 *                       `budget_allocation_decisions` snapshot's
 *                       `final_amount_php`). This is literally "what you
 *                       budgeted", so it always wins.
 *   2 · `'suggested'` — the allocation engine's recommendation for that leaf
 *                       (`computeBudgetAllocation` with no pins), the same
 *                       number the "Suggested budget split" prints higher up
 *                       this page. ONE function called twice, not two
 *                       mechanisms: same pure inputs, same output.
 *
 * ⚠ THE ROW MUST SAY WHICH. `budget_allocation_decisions` had **0 rows in
 * production** on 2026-09-03 — nobody has ever saved a plan — so today every
 * Planned figure is source 2. Printing a suggestion under a column headed
 * "what you budgeted" without naming it would put a number in the couple's
 * mouth, which is the same class of defect as the ₱0. `plannedSource` is
 * carried per row for exactly the reason `AllocationInputs.budgetSource`
 * carries `'stated' | 'band' | null`: a surface that acts on a derived figure
 * has to say it derived it.
 *
 * ── Headroom that is banked vs headroom that is merely unspent ──────────────
 * Feeding agreed money to `computeBudgetOverspend` changes what "headroom"
 * means, and the difference is real money. A category the couple has finished
 * booking UNDER its plan has banked that difference. A category they have not
 * booked at all shows its whole plan as headroom — which is not savings, it is
 * just money not spent YET, and it will mostly disappear when they book.
 *
 * Both are `planned − agreed`; only one is safe to spend. `nothingAgreedYet`
 * splits them, and `absorption.unbankedSourceKeys` names the sources the plan
 * leans on that have not been booked, so the copy can say so instead of
 * promising cover that does not exist.
 *
 * Pure: no Supabase, no React, no clock. All amounts whole PHP.
 */

import { computeBudgetOverspend, type OverspendResult } from './budget-overspend';
import type { EventMoney, MoneyBucket } from './budget-truth';

/**
 * The four column headings, in order. OWNER-LOCKED — see the docblock.
 * The page renders these strings; it never spells its own.
 */
export const BUDGET_LEDGER_COLUMNS = ['Planned', 'Agreed', 'Paid', 'Owed'] as const;

export type BudgetLedgerColumn = (typeof BUDGET_LEDGER_COLUMNS)[number];

/** One-line gloss per column, so the header can explain itself in place. */
export const BUDGET_LEDGER_COLUMN_HINTS: Record<BudgetLedgerColumn, string> = {
  Planned: 'What you budgeted',
  Agreed: 'What you signed for',
  Paid: 'Handed over so far',
  Owed: 'Agreed minus paid',
};

/** @see the "Where Planned comes from" section of the module docblock. */
export type PlannedSource = 'saved' | 'suggested';

export type BudgetLedgerRow = {
  /** Plan-group id, `'setnayan_services'` or `'other'` — `MoneyBucket.bucketId`. */
  bucketId: string;
  label: string;
  /** §18.5 rule 5 — null when nothing can price this leaf. NEVER 0. */
  plannedPhp: number | null;
  /** null exactly when `plannedPhp` is null. */
  plannedSource: PlannedSource | null;
  /** `plannedPhp === null` — render Planned as "—", not ₱0. */
  unplanned: boolean;
  /** What the couple has AGREED to pay in this category. */
  agreedPhp: number;
  paidPhp: number;
  /** Still owed — `MoneyBucket.stillOwedPhp`, floored per vendor. */
  owedPhp: number;
  /** Handed over beyond what was agreed. §18.5 rule 6. */
  overpaidPhp: number;
  /** Owed on milestones whose date has PASSED (BA5's `MoneyDue.overduePhp`). */
  overduePhp: number;
  overdueCount: number;
  /** agreed − planned when positive. 0 when under or unplanned. */
  overByPhp: number;
  /** planned − agreed when positive. 0 when over or unplanned. */
  headroomPhp: number;
  /**
   * Nothing agreed here yet. Its `headroomPhp` is unspent money, not banked
   * savings — see the docblock. False for every over-plan row.
   */
  nothingAgreedYet: boolean;
  /** Estimates parked against this category. Never part of `agreedPhp`. */
  estimatedPhp: number;
};

export type BudgetLedger = {
  /** Highest agreed first, then largest plan, then label. Deterministic. */
  rows: BudgetLedgerRow[];
  totals: {
    /** Σ of the rows that HAVE a plan. null when not one row does. */
    plannedPhp: number | null;
    agreedPhp: number;
    paidPhp: number;
    owedPhp: number;
    overduePhp: number;
  };
  /**
   * Agreed-vs-planned overspend + the greedy absorption plan, from the shared
   * `computeBudgetOverspend`. null when no row carries a plan to compare to.
   */
  absorption:
    | (OverspendResult & {
        /**
         * Keys the transfers draw from that have NOTHING agreed yet — their
         * headroom is unspent, not banked. The copy must not promise it.
         */
        unbankedSourceKeys: string[];
        /** Σ of the transfer amounts drawn from those unbanked sources. */
        unbankedCoverPhp: number;
      })
    | null;
  /** Rows carrying agreed money with no plan at all — §18.5 rule 5's subjects. */
  unplannedWithMoney: BudgetLedgerRow[];
};

/**
 * A planned figure, or null. **Zero is not a plan** — it is either the engine
 * giving a leaf nothing or a snapshot column defaulting, and printing ₱0 under
 * "what you budgeted" is the exact lie §18.5 rule 5 forbids. Folding it here
 * makes the rule structural: no caller can produce a ₱0 Planned.
 */
function plannedFrom(n: number | null | undefined): number | null {
  if (n === null || n === undefined) return null;
  const v = Number(n);
  if (!Number.isFinite(v)) return null;
  const whole = Math.round(v);
  return whole > 0 ? whole : null;
}

const wholePhp = (n: number | null | undefined): number => {
  const v = Number(n ?? 0);
  return Number.isFinite(v) ? Math.round(v) : 0;
};

/**
 * Build the per-category ledger.
 *
 * `money` is the resolver's output — the ONLY source of agreed/paid/owed here.
 * When it is null (resolver refused, or the budget-truth flag is off) there is
 * no per-category truth to print, so the caller must render nothing rather
 * than a table of confident zeroes.
 *
 * @param savedPlanPhp   bucketId → the couple's saved `final_amount_php`.
 * @param suggestedPhp   bucketId → `computeBudgetAllocation`'s recommendation.
 * @param labelFor       optional label for a planned leaf carrying no money
 *                       (so it has no `MoneyBucket` to take a label from).
 */
export function buildBudgetLedger(args: {
  money: EventMoney;
  savedPlanPhp?: ReadonlyMap<string, number | null>;
  suggestedPhp?: ReadonlyMap<string, number | null>;
  labelFor?: (bucketId: string) => string;
}): BudgetLedger {
  const { money, savedPlanPhp, suggestedPhp, labelFor } = args;
  const saved = savedPlanPhp ?? new Map<string, number | null>();
  const suggested = suggestedPhp ?? new Map<string, number | null>();

  const bucketById = new Map<string, MoneyBucket>();
  for (const b of money.byBucket) bucketById.set(b.bucketId, b);

  // EVERY bucket carrying money gets a row — that is the first guard, and it is
  // why the union starts from `byBucket` rather than from the plan. A category
  // with money and no plan is precisely the case §18.5 rule 5 is about; it must
  // appear and say "no typical price yet", not vanish for lacking a benchmark.
  const ids = new Set<string>(bucketById.keys());
  // A category the couple budgeted for but has not booked belongs here too —
  // "the plan meets the ledger" is a two-sided sentence.
  for (const [id, php] of saved) if (plannedFrom(php) !== null) ids.add(id);
  for (const [id, php] of suggested) if (plannedFrom(php) !== null) ids.add(id);

  const rows: BudgetLedgerRow[] = [];
  for (const bucketId of ids) {
    const b = bucketById.get(bucketId) ?? null;

    // Saved wins: it is the couple's own number. The suggestion is what we
    // would have proposed, and it must never overwrite what they decided.
    const savedPlan = plannedFrom(saved.get(bucketId));
    const plannedPhp = savedPlan ?? plannedFrom(suggested.get(bucketId));
    const plannedSource: PlannedSource | null =
      plannedPhp === null ? null : savedPlan !== null ? 'saved' : 'suggested';

    const agreedPhp = wholePhp(b?.committedPhp);
    const delta = plannedPhp === null ? 0 : agreedPhp - plannedPhp;

    rows.push({
      bucketId,
      label: b?.label ?? labelFor?.(bucketId) ?? bucketId,
      plannedPhp,
      plannedSource,
      unplanned: plannedPhp === null,
      agreedPhp,
      paidPhp: wholePhp(b?.paidPhp),
      owedPhp: wholePhp(b?.stillOwedPhp),
      overpaidPhp: wholePhp(b?.overpaidPhp),
      overduePhp: wholePhp(b?.due?.overduePhp),
      overdueCount: b?.due?.overdueCount ?? 0,
      overByPhp: delta > 0 ? delta : 0,
      headroomPhp: delta < 0 ? -delta : 0,
      nothingAgreedYet: agreedPhp === 0,
      estimatedPhp: wholePhp(b?.estimatedPhp),
    });
  }

  rows.sort((a, b) => {
    if (b.agreedPhp !== a.agreedPhp) return b.agreedPhp - a.agreedPhp;
    const ap = a.plannedPhp ?? 0;
    const bp = b.plannedPhp ?? 0;
    if (bp !== ap) return bp - ap;
    return a.label.localeCompare(b.label);
  });

  // The absorption plan, from the SHARED engine — the couple's agreed money
  // against their own plan, which is the substitution this whole slice is.
  // `computeBudgetOverspend` skips any category whose benchmark is <= 0, so
  // unplanned rows correctly neither overspend nor offer headroom.
  const planned = rows.filter((r) => r.plannedPhp !== null);
  const overspend =
    planned.length === 0
      ? null
      : computeBudgetOverspend(
          planned.map((r) => ({
            key: r.bucketId,
            label: r.label,
            benchmarkPhp: r.plannedPhp!,
            actualPhp: r.agreedPhp,
          })),
        );

  let absorption: BudgetLedger['absorption'] = null;
  if (overspend) {
    const unbanked = new Set(rows.filter((r) => r.nothingAgreedYet).map((r) => r.bucketId));
    const unbankedSourceKeys: string[] = [];
    let unbankedCoverPhp = 0;
    for (const t of overspend.transfers) {
      if (!unbanked.has(t.fromKey)) continue;
      if (!unbankedSourceKeys.includes(t.fromKey)) unbankedSourceKeys.push(t.fromKey);
      unbankedCoverPhp += t.amountPhp;
    }
    absorption = { ...overspend, unbankedSourceKeys, unbankedCoverPhp };
  }

  const plannedTotal = planned.reduce((s, r) => s + (r.plannedPhp ?? 0), 0);

  return {
    rows,
    totals: {
      plannedPhp: planned.length === 0 ? null : plannedTotal,
      agreedPhp: rows.reduce((s, r) => s + r.agreedPhp, 0),
      paidPhp: rows.reduce((s, r) => s + r.paidPhp, 0),
      owedPhp: rows.reduce((s, r) => s + r.owedPhp, 0),
      overduePhp: rows.reduce((s, r) => s + r.overduePhp, 0),
    },
    absorption,
    unplannedWithMoney: rows.filter((r) => r.unplanned && r.agreedPhp > 0),
  };
}
