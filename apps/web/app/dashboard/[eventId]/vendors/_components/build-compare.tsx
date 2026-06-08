/**
 * BuildCompare — the Services takeover's "Compare" tab (Budget "Build").
 * Spec: `Budget_Build_Services_Takeover_2026-06-08.md`.
 *
 * Compares the three budget baskets the engine produces side-by-side:
 *   Lean   = Σ each category's range-LOW   (all-floor, value)
 *   Fits   = Σ each category's median      (complete & solid — the default)
 *   Stretch= Σ each category's range-HIGH  (premium headroom)
 * Derived from a SINGLE `computeBudgetAllocation` run (the same engine the Build
 * tab uses) — every leaf already carries `amountPhp` + `rangeLowPhp/HighPhp`, so
 * the three columns need no extra query and no persistence.
 *
 * Follow-ons (need their own work): saving named A/B/C combinations + the
 * "available wedding dates per build" (the vendor-availability intersection over a
 * build's specific vendors). This v1 compares the budget shape, not specific vendors.
 *
 * Server component (pure render) — passed as the takeover's `compareSlot`.
 */
import { computeBudgetAllocation, type AllocationConfig } from '@/lib/budget-allocation';
import type { PlannerLeafInput } from '@/lib/budget-allocation-data';

const peso = (php: number) => `₱${Math.round(php ?? 0).toLocaleString('en-PH')}`;

type Basket = { key: 'lean' | 'fits' | 'stretch'; label: string; blurb: string };
const BASKETS: Basket[] = [
  { key: 'lean', label: 'Lean', blurb: 'Every category at its lowest viable price.' },
  { key: 'fits', label: 'Fits', blurb: 'Typical, complete & solid — the suggested plan.' },
  { key: 'stretch', label: 'Stretch', blurb: 'Premium headroom on every category.' },
];

export function BuildCompare({
  budgetPhp,
  leaves,
  config,
}: {
  budgetPhp: number | null;
  leaves: PlannerLeafInput[];
  config: Partial<AllocationConfig>;
}) {
  if (budgetPhp == null || leaves.length === 0) {
    return (
      <div className="mx-auto flex max-w-md flex-col items-center gap-3 px-6 py-16 text-center">
        <h2 className="text-lg font-semibold text-ink">Set a budget to compare</h2>
        <p className="text-sm text-ink/60">
          Once you set a budget on the Build tab, you can compare a Lean, Fits and Stretch version of
          your wedding side by side.
        </p>
      </div>
    );
  }

  const result = computeBudgetAllocation({ budgetPhp, leaves, config });
  const labelOf = new Map(leaves.map((l) => [l.canonicalService, l.label]));
  const rows = result.leaves.map((l) => ({
    label: labelOf.get(l.canonicalService) ?? l.canonicalService,
    lean: l.rangeLowPhp,
    fits: l.amountPhp,
    stretch: l.rangeHighPhp,
  }));
  const totals = rows.reduce(
    (a, r) => ({ lean: a.lean + r.lean, fits: a.fits + r.fits, stretch: a.stretch + r.stretch }),
    { lean: 0, fits: 0, stretch: 0 },
  );

  const overUnder = (total: number) => {
    const diff = total - budgetPhp;
    if (Math.abs(diff) < 1) return { text: 'on budget', tone: 'text-emerald-700' };
    return diff > 0
      ? { text: `${peso(diff)} over`, tone: 'text-rose-700' }
      : { text: `${peso(-diff)} to spare`, tone: 'text-emerald-700' };
  };

  return (
    <div className="mx-auto max-w-3xl space-y-5 px-1 py-2">
      <div className="space-y-1">
        <h2 className="font-display text-2xl italic text-ink">Compare your options</h2>
        <p className="text-sm text-ink/60">
          Three versions of the same wedding, against your {peso(budgetPhp)} budget.
        </p>
      </div>

      {/* Basket headers + totals */}
      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        {BASKETS.map((b) => {
          const total = totals[b.key];
          const ou = overUnder(total);
          const isFits = b.key === 'fits';
          return (
            <div
              key={b.key}
              className={`rounded-2xl border p-3 text-center ${isFits ? 'border-terracotta/40 bg-terracotta/5' : 'border-ink/10 bg-cream'}`}
            >
              <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink/55">
                {b.label}
              </div>
              <div className="mt-1 font-display text-xl italic text-ink sm:text-2xl">{peso(total)}</div>
              <div className={`mt-0.5 text-[11px] ${ou.tone}`}>{ou.text}</div>
            </div>
          );
        })}
      </div>

      {/* Per-category breakdown */}
      <div className="overflow-hidden rounded-2xl border border-ink/10">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="bg-ink/[0.03] text-left">
              <th className="px-3 py-2 font-mono text-[10px] uppercase tracking-[0.12em] text-ink/50">
                Category
              </th>
              <th className="px-2 py-2 text-right font-mono text-[10px] uppercase tracking-[0.12em] text-ink/50">
                Lean
              </th>
              <th className="px-2 py-2 text-right font-mono text-[10px] uppercase tracking-[0.12em] text-terracotta">
                Fits
              </th>
              <th className="px-2 py-2 text-right font-mono text-[10px] uppercase tracking-[0.12em] text-ink/50">
                Stretch
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.label} className="border-t border-ink/8">
                <td className="px-3 py-2 text-ink/80">{r.label}</td>
                <td className="px-2 py-2 text-right tabular-nums text-ink/60">{peso(r.lean)}</td>
                <td className="px-2 py-2 text-right tabular-nums font-medium text-ink">{peso(r.fits)}</td>
                <td className="px-2 py-2 text-right tabular-nums text-ink/60">{peso(r.stretch)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-ink/45">
        Saving named A/B/C combinations and showing each build&rsquo;s available wedding dates are
        coming next.
      </p>
    </div>
  );
}
