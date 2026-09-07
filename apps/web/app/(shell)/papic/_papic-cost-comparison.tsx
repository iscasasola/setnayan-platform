/**
 * "WHAT THIS WOULD OTHERWISE COST YOU" — the market-cost comparison.
 * See `lib/papic-cost-comparison.ts` for the derivation and the flag on the
 * photographer-side assumption. This component only renders the already-built
 * `PapicCostComparison`; it does no arithmetic of its own beyond formatting.
 *
 * ⚠ FRAMED AS EXTRA COVERAGE, NOT AS A CLAIM ABOUT ANYONE'S CRAFT — the same
 * line the FAQ answer above draws for "Will this upset our photographer?".
 * This section is about what covering MORE of the room costs another way, not
 * a claim that Papic replaces what a photographer does.
 *
 * Server component: no state, no client bundle, mirrors `_papic-sections.tsx`.
 */

import {
  COMPARISON_PHOTOGRAPHER_SHOTS_PER_HOUR,
  type PapicCostComparison,
} from '@/lib/papic-cost-comparison';

const peso = (n: number) => '₱' + n.toLocaleString('en-PH');
const count = (n: number) => n.toLocaleString('en-PH');

export function PapicCostComparisonSection({
  comparison,
}: {
  comparison: PapicCostComparison;
}) {
  const { photographerShots, photographerPeso, papicShots, papicPeso, timesCheaper } = comparison;

  return (
    <section className="mx-auto mt-16 max-w-2xl" aria-label="What this would otherwise cost you">
      <h2 className="font-serif text-2xl tracking-tight text-[var(--m-ink)] sm:text-3xl">
        What this would otherwise cost you
      </h2>
      <div className="mt-4 rounded-xl border border-[var(--m-line)] px-4 py-4">
        <p className="text-[0.92rem] text-[var(--m-ink)]">
          A single photographer covering more of the room — walking the reception instead of
          staying with the two of you — is one way people do this today. A typical rate is
          around <span className="font-mono font-medium tabular-nums">{peso(photographerPeso)}</span>{' '}
          for about{' '}
          <span className="font-mono font-medium tabular-nums">
            {count(COMPARISON_PHOTOGRAPHER_SHOTS_PER_HOUR)}
          </span>{' '}
          photographs an hour — across a four-hour reception, roughly{' '}
          <span className="font-mono font-medium tabular-nums">{count(photographerShots)}</span>{' '}
          photographs.
        </p>
        <p className="mt-3 border-t border-[var(--m-line)] pt-3 text-[0.92rem] text-[var(--m-ink)]">
          On Papic, <span className="font-mono font-medium tabular-nums">{count(papicShots)}</span>{' '}
          credits cost{' '}
          <span className="font-mono font-medium tabular-nums text-[var(--m-mulberry)]">
            {peso(papicPeso)}
          </span>{' '}
          — about{' '}
          <span className="font-mono font-medium tabular-nums text-[var(--m-mulberry)]">
            {timesCheaper}×
          </span>{' '}
          less for every photograph, taken from every guest’s own phone at once instead of one
          person working through the crowd.
        </p>
        <p className="mt-3 text-[0.78rem] text-[var(--m-slate-2)]">
          A typical photographer’s rate, for comparison — not a quote for any particular supplier.
        </p>
      </div>
    </section>
  );
}
