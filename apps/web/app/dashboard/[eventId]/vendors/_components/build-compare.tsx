'use client';

/**
 * BuildCompare — the Services takeover's "Compare" tab (Budget "Build").
 * Spec: `Budget_Build_Services_Takeover_2026-06-08.md`.
 *
 * Two layers:
 *  1. The three LIVE budget baskets, side-by-side, derived from a single
 *     `computeBudgetAllocation` run (each leaf carries amountPhp + rangeLow/HighPhp):
 *       Lean = Σ range-low · Fits = Σ median · Stretch = Σ range-high.
 *  2. SAVE the currently-viewed basket into a named slot (A/B/C) → `budget_builds`
 *     (couple-own), and compare the saved builds you've banked over time. A couple
 *     varies the budget/services on the Build tab between saves to bank real
 *     alternatives ("Fits at ₱500k" vs "Lean at ₱400k").
 *
 * Client component (runs the pure engine like the planner, + the save/delete
 * actions). Follow-on: "available wedding dates per saved build" (the vendor-
 * availability intersection over a saved build's specific vendors).
 */

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Bookmark, Loader2, Trash2 } from 'lucide-react';
import { computeBudgetAllocation, type AllocationConfig } from '@/lib/budget-allocation';
import type { PlannerLeafInput } from '@/lib/budget-allocation-data';
import {
  saveBudgetBuild,
  deleteBudgetBuild,
  type SavedBuild,
  type BuildBasket,
  type BuildSlot,
} from '../build-actions';

const peso = (php: number) => `₱${Math.round(php ?? 0).toLocaleString('en-PH')}`;
const SLOTS: BuildSlot[] = ['A', 'B', 'C'];
const BASKETS: { key: BuildBasket; label: string }[] = [
  { key: 'lean', label: 'Lean' },
  { key: 'fits', label: 'Fits' },
  { key: 'stretch', label: 'Stretch' },
];
const BASKET_LABEL: Record<BuildBasket, string> = { lean: 'Lean', fits: 'Fits', stretch: 'Stretch' };

export function BuildCompare({
  eventId,
  budgetPhp,
  leaves,
  config,
  savedBuilds,
}: {
  eventId: string;
  budgetPhp: number | null;
  leaves: PlannerLeafInput[];
  config: Partial<AllocationConfig>;
  savedBuilds: SavedBuild[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [basket, setBasket] = useState<BuildBasket>('fits');
  const takenSlots = useMemo(() => new Set(savedBuilds.map((b) => b.label)), [savedBuilds]);
  const firstFreeSlot = SLOTS.find((s) => !takenSlots.has(s)) ?? 'A';
  const [slot, setSlot] = useState<BuildSlot>(firstFreeSlot);
  const [err, setErr] = useState<string | null>(null);

  const computed = useMemo(() => {
    if (budgetPhp == null || leaves.length === 0) return null;
    const result = computeBudgetAllocation({ budgetPhp, leaves, config });
    const labelOf = new Map(leaves.map((l) => [l.canonicalService, l.label]));
    const rows = result.leaves.map((l) => ({
      canonicalService: l.canonicalService,
      label: labelOf.get(l.canonicalService) ?? l.canonicalService,
      lean: l.rangeLowPhp,
      fits: l.amountPhp,
      stretch: l.rangeHighPhp,
    }));
    const totals = rows.reduce(
      (a, r) => ({ lean: a.lean + r.lean, fits: a.fits + r.fits, stretch: a.stretch + r.stretch }),
      { lean: 0, fits: 0, stretch: 0 },
    );
    return { rows, totals };
  }, [budgetPhp, leaves, config]);

  if (budgetPhp == null || !computed) {
    return (
      <div className="mx-auto flex max-w-md flex-col items-center gap-3 px-6 py-16 text-center">
        <h2 className="text-lg font-semibold text-ink">Set a budget to compare</h2>
        <p className="text-sm text-ink/60">
          Once you set a budget on the Build tab, you can compare a Lean, Fits and Stretch version of
          your wedding — and save the ones you like to compare side by side.
        </p>
      </div>
    );
  }

  const { rows, totals } = computed;
  const overUnder = (total: number) => {
    const diff = total - budgetPhp;
    if (Math.abs(diff) < 1) return { text: 'on budget', tone: 'text-emerald-700' };
    return diff > 0
      ? { text: `${peso(diff)} over`, tone: 'text-rose-700' }
      : { text: `${peso(-diff)} to spare`, tone: 'text-emerald-700' };
  };

  function onSave() {
    setErr(null);
    const snapshotLeaves = rows.map((r) => ({
      canonicalService: r.canonicalService,
      label: r.label,
      amountPhp: r[basket],
      rangeLowPhp: r.lean,
      rangeHighPhp: r.stretch,
    }));
    const totalPhp = totals[basket];
    startTransition(async () => {
      const res = await saveBudgetBuild({
        eventId,
        label: slot,
        snapshot: { budgetPhp, basket, totalPhp, leaves: snapshotLeaves },
      });
      if (!res.ok) setErr(res.error);
      else router.refresh();
    });
  }

  function onDelete(buildId: string) {
    setErr(null);
    startTransition(async () => {
      const res = await deleteBudgetBuild({ eventId, buildId });
      if (!res.ok) setErr(res.error);
      else router.refresh();
    });
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-1 py-2">
      <div className="space-y-1">
        <h2 className="font-display text-2xl italic text-ink">Compare your options</h2>
        <p className="text-sm text-ink/60">
          Three versions of the same wedding, against your {peso(budgetPhp)} budget.
        </p>
      </div>

      {/* Live baskets */}
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
              <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink/55">{b.label}</div>
              <div className="mt-1 font-display text-xl italic text-ink sm:text-2xl">{peso(total)}</div>
              <div className={`mt-0.5 text-[11px] ${ou.tone}`}>{ou.text}</div>
            </div>
          );
        })}
      </div>

      {/* Save control */}
      <div className="space-y-2 rounded-2xl border border-ink/10 bg-cream p-4">
        <div className="flex flex-wrap items-center gap-2 text-sm text-ink/80">
          <Bookmark className="h-4 w-4 text-terracotta" strokeWidth={1.75} aria-hidden />
          Save the
          <select
            value={basket}
            onChange={(e) => setBasket(e.target.value as BuildBasket)}
            className="rounded-md border border-ink/15 bg-paper px-2 py-1 text-sm"
            aria-label="Basket to save"
          >
            {BASKETS.map((b) => (
              <option key={b.key} value={b.key}>
                {b.label}
              </option>
            ))}
          </select>
          plan to slot
          <select
            value={slot}
            onChange={(e) => setSlot(e.target.value as BuildSlot)}
            className="rounded-md border border-ink/15 bg-paper px-2 py-1 text-sm"
            aria-label="Slot to save into"
          >
            {SLOTS.map((s) => (
              <option key={s} value={s}>
                {s}
                {takenSlots.has(s) ? ' (replace)' : ''}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={onSave}
            disabled={pending}
            className="inline-flex items-center gap-1.5 rounded-md bg-ink px-3 py-1.5 text-sm font-medium text-paper transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : null}
            Save
          </button>
        </div>
        {err ? <p className="text-xs text-rose-700">{err}</p> : null}
      </div>

      {/* Saved builds */}
      {savedBuilds.length > 0 && (
        <div className="space-y-2">
          <h3 className="font-display text-lg italic text-ink/85">Your saved builds</h3>
          <div className="grid gap-2 sm:grid-cols-3">
            {savedBuilds.map((b) => {
              const ou = b.total_php != null ? overUnder(b.total_php) : null;
              return (
                <div key={b.build_id} className="relative rounded-2xl border border-ink/10 bg-cream p-3">
                  <button
                    type="button"
                    onClick={() => onDelete(b.build_id)}
                    disabled={pending}
                    aria-label={`Delete build ${b.label}`}
                    className="absolute right-2 top-2 inline-flex h-6 w-6 items-center justify-center rounded-full text-ink/40 hover:bg-ink/5 hover:text-rose-600 disabled:opacity-50"
                  >
                    <Trash2 className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden />
                  </button>
                  <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-terracotta">
                    Build {b.label}
                  </div>
                  <div className="mt-1 font-display text-lg italic text-ink">
                    {b.total_php != null ? peso(b.total_php) : '—'}
                  </div>
                  <div className="mt-0.5 text-[11px] text-ink/55">
                    {BASKET_LABEL[b.basket]}
                    {b.budget_php != null ? ` · ${peso(b.budget_php)} budget` : ''}
                  </div>
                  {ou ? <div className={`mt-0.5 text-[11px] ${ou.tone}`}>{ou.text}</div> : null}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Per-category breakdown of the live baskets */}
      <div className="overflow-hidden rounded-2xl border border-ink/10">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="bg-ink/[0.03] text-left">
              <th className="px-3 py-2 font-mono text-[10px] uppercase tracking-[0.12em] text-ink/50">Category</th>
              <th className="px-2 py-2 text-right font-mono text-[10px] uppercase tracking-[0.12em] text-ink/50">Lean</th>
              <th className="px-2 py-2 text-right font-mono text-[10px] uppercase tracking-[0.12em] text-terracotta">Fits</th>
              <th className="px-2 py-2 text-right font-mono text-[10px] uppercase tracking-[0.12em] text-ink/50">Stretch</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.canonicalService} className="border-t border-ink/8">
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
        Showing each saved build&rsquo;s available wedding dates (your team&rsquo;s common openings) is
        coming next.
      </p>
    </div>
  );
}
