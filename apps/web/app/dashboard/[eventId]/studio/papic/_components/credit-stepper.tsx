'use client';

import { useId, useState } from 'react';
import { Minus, Plus } from 'lucide-react';

export type StepperRung = {
  serviceCode: string;
  points: number;
  pricePhp: number;
  /** Whole-percent saving against ₱1 a shot, or null when there is none. */
  discountPercent: number | null;
};

/**
 * HOW MUCH TO ADD — a plus/minus, not a dropdown.
 *
 * Owner, 2026-08-28, looking at the live card: *"we want a +- value and they
 * will see how much will be added. from 50 pesos to 10,000 pesos?"* — and he had
 * the range exactly right: the sixteen live rungs run ₱50 to ₱10,000.
 *
 * ── WHY A STEPPER AND NOT A FREE PESO FIELD ─────────────────────────────────
 * 🔑 THE LADDER IS SIXTEEN PRICED RUNGS, NOT A FORMULA. Each one carries its own
 * discount, deepening as the number grows, and the set is owner-locked. A free
 * "type any amount from ₱50 to ₱10,000" box would have to invent a price for
 * ₱137 — which is a pricing decision, not a control. So the stepper WALKS the
 * real rungs: every press lands on something the catalog actually sells, and the
 * person sees both halves of the trade at once — what they pay, and what lands
 * in the pool.
 *
 * ⚠ NOT ONE FIGURE IS TYPED HERE. Prices, credit counts and the saving all
 * arrive as props read from `platform_retail_catalog_v2`. That is load-bearing
 * right now: the top rung is ₱10,000 today and an owner price sheet moving it to
 * ₱11,200 is in flight. A number spelled in this file would quietly outrank his.
 *
 * ⚠ THE HIDDEN FIELD IS THE SERVICE CODE, NEVER THE AMOUNT. The server charges
 * off the code and re-reads the price itself, so a tampered client can move which
 * rung it asks for but can never move what a rung costs.
 */
export function CreditStepper({ rungs }: { rungs: readonly StepperRung[] }) {
  const [i, setI] = useState(0);
  const liveId = useId();

  // A caller with no sellable rung renders no card at all, so this is a
  // belt-and-braces guard rather than a state anybody can reach.
  if (rungs.length === 0) return null;

  const at = Math.min(Math.max(i, 0), rungs.length - 1);
  const rung = rungs[at];
  const floor = rungs[0];
  const ceiling = rungs[rungs.length - 1];
  // ⚠ `noUncheckedIndexedAccess` is on in this repo, and it is right to be: the
  // clamp above guarantees these three exist, but a future edit to the clamp
  // would not. Reading them once, here, is what keeps that guarantee in one
  // place instead of at five render sites.
  if (!rung || !floor || !ceiling) return null;
  const atFloor = at === 0;
  const atCeiling = at === rungs.length - 1;

  const peso = (n: number) => `₱${n.toLocaleString('en-PH')}`;

  return (
    <div className="space-y-2">
      <span className="block text-xs font-medium text-ink/70">How much to add</span>

      <div className="flex items-stretch gap-2">
        <button
          type="button"
          onClick={() => setI(at - 1)}
          disabled={atFloor}
          aria-label="Less"
          className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-ink/15 text-ink/70 transition-colors hover:bg-ink/5 hover:text-ink disabled:cursor-not-allowed disabled:opacity-35 disabled:hover:bg-transparent"
        >
          <Minus aria-hidden className="h-4 w-4" strokeWidth={2} />
        </button>

        {/* ⚠ aria-live, because the two buttons never change their own labels —
            without it a screen-reader user presses "More" and is told nothing at
            all about what moved. */}
        <div
          id={liveId}
          aria-live="polite"
          className="flex min-w-0 flex-1 flex-col items-center justify-center rounded-xl border border-ink/15 bg-surface px-3 py-2 text-center"
        >
          <span className="font-mono text-xl font-semibold tabular-nums text-ink">
            {peso(rung.pricePhp)}
          </span>
          <span className="text-xs text-ink/65">
            adds {rung.points.toLocaleString('en-PH')} shots
            {rung.discountPercent != null ? ` · ${rung.discountPercent}% off` : ''}
          </span>
        </div>

        <button
          type="button"
          onClick={() => setI(at + 1)}
          disabled={atCeiling}
          aria-label="More"
          className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-ink/15 text-ink/70 transition-colors hover:bg-ink/5 hover:text-ink disabled:cursor-not-allowed disabled:opacity-35 disabled:hover:bg-transparent"
        >
          <Plus aria-hidden className="h-4 w-4" strokeWidth={2} />
        </button>
      </div>

      {/* The two ends of the ladder, said once, so a disabled button is never a
          dead end somebody has to guess at. Both figures are the real first and
          last rung — never a typed range. */}
      <p className="text-[11px] text-ink/50">
        {peso(floor.pricePhp)} to {peso(ceiling.pricePhp)} ·{' '}
        {rungs.length} sizes · add any of them again later.
      </p>

      <input type="hidden" name="service_code" value={rung.serviceCode} />
    </div>
  );
}
