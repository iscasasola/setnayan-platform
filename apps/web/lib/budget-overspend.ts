/**
 * Budget overspend + absorption planner — pure, deterministic ₱ math.
 *
 * The COUNTERPART to the warning the allocation engine can't give on its own:
 * `lib/budget-allocation.ts` recommends a benchmark ₱ target per service leaf;
 * this module compares the couple's ACTUAL chosen number for each category
 * against that benchmark and, when a category is over, works out **exactly which
 * under-budget categories have the headroom to absorb the excess** — so the
 * banner can say "Photography is ₱8,000 over; Flowers and Cake are ₱9,500 under
 * between them, so you're still covered" instead of a bare "over budget".
 *
 * Pure + integration-agnostic (no Supabase, no React, no clock): the caller
 * resolves `{ benchmarkPhp, actualPhp }` per category from whatever surface has
 * both (the allocation planner pairs the engine's recommendation with the
 * couple's pin); this module only does the arithmetic. No prices are invented —
 * every number is caller-supplied. All amounts are whole PHP.
 *
 * The absorption plan is a deterministic greedy match: largest overspend first,
 * drained against the largest-headroom under-budget categories. It never moves
 * more than a category's real headroom, and `netOverPhp` reports any excess that
 * NO under-budget category can cover (the genuinely-over-budget remainder).
 */

export type OverspendCategoryInput = {
  /** Stable key (e.g. canonical service leaf) — identity for transfers. */
  key: string;
  /** Human label for the banner copy. */
  label: string;
  /** The recommended/benchmark ₱ target for this category. */
  benchmarkPhp: number;
  /** The couple's actual or chosen ₱ for this category. */
  actualPhp: number;
};

export type OverspentCategory = {
  key: string;
  label: string;
  benchmarkPhp: number;
  actualPhp: number;
  /** actual − benchmark (> 0). */
  overByPhp: number;
};

export type UnderBudgetCategory = {
  key: string;
  label: string;
  benchmarkPhp: number;
  actualPhp: number;
  /** benchmark − actual (> 0) — spare room before this category hits benchmark. */
  headroomPhp: number;
};

export type AbsorptionTransfer = {
  fromKey: string;
  fromLabel: string;
  toKey: string;
  toLabel: string;
  amountPhp: number;
};

export type OverspendResult = {
  /** Categories above their benchmark, largest overspend first. */
  overspent: OverspentCategory[];
  /** Categories below their benchmark, largest headroom first. */
  underBudget: UnderBudgetCategory[];
  /** Σ overspend across all over categories. */
  totalOverspendPhp: number;
  /** Σ headroom across all under categories. */
  totalHeadroomPhp: number;
  /** Overspend that no under-budget headroom can cover = real budget breach. */
  netOverPhp: number;
  /** True when total headroom ≥ total overspend (the excess can be re-balanced). */
  fullyAbsorbable: boolean;
  /** Whether any category is over benchmark at all (drives banner visibility). */
  hasOverspend: boolean;
  /** Greedy plan: which under category covers which overspend, and by how much. */
  transfers: AbsorptionTransfer[];
};

function toWholePhp(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.round(n);
}

/**
 * Compute per-category overspend and a greedy absorption plan.
 *
 * Deterministic: identical inputs → identical output. Ties broken by input
 * order (stable sort), so the same category list always yields the same plan.
 *
 * @example
 * computeBudgetOverspend([
 *   { key: 'photo', label: 'Photography', benchmarkPhp: 50000, actualPhp: 58000 },
 *   { key: 'flowers', label: 'Flowers',    benchmarkPhp: 30000, actualPhp: 24000 },
 *   { key: 'cake',    label: 'Cake',       benchmarkPhp: 15000, actualPhp: 11000 },
 * ]);
 * // overspent: Photography +8,000 · underBudget: Flowers 6,000 + Cake 4,000
 * // transfers: 6,000 from Flowers + 2,000 from Cake → Photography · fullyAbsorbable
 */
export function computeBudgetOverspend(
  categories: ReadonlyArray<OverspendCategoryInput>,
): OverspendResult {
  const overspent: OverspentCategory[] = [];
  const underBudget: UnderBudgetCategory[] = [];

  for (const cat of categories) {
    const benchmarkPhp = toWholePhp(cat.benchmarkPhp);
    const actualPhp = toWholePhp(cat.actualPhp);
    // No benchmark to compare against → not an overspend signal, skip.
    if (benchmarkPhp <= 0) continue;
    const delta = actualPhp - benchmarkPhp;
    if (delta > 0) {
      overspent.push({
        key: cat.key,
        label: cat.label,
        benchmarkPhp,
        actualPhp,
        overByPhp: delta,
      });
    } else if (delta < 0) {
      underBudget.push({
        key: cat.key,
        label: cat.label,
        benchmarkPhp,
        actualPhp,
        headroomPhp: -delta,
      });
    }
  }

  // Largest overspend first; largest headroom first. Stable for deterministic ties.
  overspent.sort((a, b) => b.overByPhp - a.overByPhp);
  underBudget.sort((a, b) => b.headroomPhp - a.headroomPhp);

  const totalOverspendPhp = overspent.reduce((s, c) => s + c.overByPhp, 0);
  const totalHeadroomPhp = underBudget.reduce((s, c) => s + c.headroomPhp, 0);

  // Greedy absorption: walk each overspend, drain it from the deepest-headroom
  // under categories until covered or the headroom runs out. A running ledger
  // tracks remaining headroom per source so the plan never double-spends.
  const remainingHeadroom = new Map<string, number>(
    underBudget.map((c) => [c.key, c.headroomPhp]),
  );
  const transfers: AbsorptionTransfer[] = [];
  for (const over of overspent) {
    let need = over.overByPhp;
    for (const under of underBudget) {
      if (need <= 0) break;
      const avail = remainingHeadroom.get(under.key) ?? 0;
      if (avail <= 0) continue;
      const move = Math.min(avail, need);
      transfers.push({
        fromKey: under.key,
        fromLabel: under.label,
        toKey: over.key,
        toLabel: over.label,
        amountPhp: move,
      });
      remainingHeadroom.set(under.key, avail - move);
      need -= move;
    }
  }

  const netOverPhp = Math.max(0, totalOverspendPhp - totalHeadroomPhp);

  return {
    overspent,
    underBudget,
    totalOverspendPhp,
    totalHeadroomPhp,
    netOverPhp,
    fullyAbsorbable: totalOverspendPhp > 0 && totalHeadroomPhp >= totalOverspendPhp,
    hasOverspend: totalOverspendPhp > 0,
    transfers,
  };
}
