/**
 * Pure presentation helpers for the checklist budget health-check.
 *
 * Kept separate from `lib/checklist-budget.ts` (which is `server-only` — it does
 * DB reads) so these can be imported by the render component AND unit-tested
 * outside a request context. Type-only import of `ChecklistBudgetHealth`.
 *
 * Spec: Adaptive_Checklist_Design_2026-06-17.md §5 (budget health states).
 */
import type { ChecklistBudgetHealth } from './checklist-budget';

/** Whole-peso display from centavos: 1_230_00 → "₱1,230". */
export function formatPeso(centavos: number): string {
  const pesos = Math.round((Number.isFinite(centavos) ? centavos : 0) / 100);
  return `₱${pesos.toLocaleString('en-PH')}`;
}

export type BudgetTone = 'good' | 'tight' | 'over';

export type BudgetHealthCopy = {
  tone: BudgetTone;
  headline: string;
  detail: string;
};

/**
 * Map a computed health object to the three display states from the design doc:
 *  - best-case buffer ≥ 0 → "good range" (green)
 *  - best ≥ 0 but worst < 0 → "you're close" (amber — fine at the low end, tight high)
 *  - best < 0 → "might not be enough" (red)
 */
export function budgetHealthCopy(health: ChecklistBudgetHealth): BudgetHealthCopy {
  const best = formatPeso(Math.abs(health.bestCaseBufferCentavos));
  const worst = formatPeso(Math.abs(health.worstCaseBufferCentavos));

  if (health.isOverBudgetBestCase) {
    return {
      tone: 'over',
      headline: 'This might be over your budget',
      detail: `Even at the lower end, you're about ${best} over. Here's where to trim, or raise the total.`,
    };
  }
  if (health.isOverBudgetWorstCase) {
    return {
      tone: 'tight',
      headline: "You're close",
      detail: `Fine if vendors come in at the lower end (${best} to spare), but tight if they run higher (${worst} over).`,
    };
  }
  return {
    tone: 'good',
    headline: "You're in a good range",
    detail: `Everything looks covered, with roughly ${worst}–${best} of buffer left.`,
  };
}
