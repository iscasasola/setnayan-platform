import { Info, TrendingUp } from 'lucide-react';

import type { FunnelBenchmark, MetricBenchmark } from '@/lib/funnel-benchmark';
import { ShopCard } from '../../_components/kit';

/**
 * FunnelBenchmarkCard — the doorway `lib/funnel-benchmark.ts` never had.
 *
 * 🔴 WHY THIS FILE EXISTS. The whole feature already shipped: the SQL bands and
 * their privacy contract (`funnel_benchmark_for_vendor`, verified live in
 * production), the min-N suppression, the percentile math, and the assembly in
 * `lib/funnel-benchmark.ts` — whose own docblock names its caller as
 * `vendor-stats-panel.tsx`, **a file that does not exist**. Measured 2026-08-25:
 * the module had ZERO importers anywhere in the repo. A vendor could not reach a
 * single line of it. Sixth "gate with no handle" in this project.
 *
 * NOTHING IS REBUILT HERE. This renders what `assembleFunnelBenchmark` already
 * returns — no second read, no second percentile, no second suppression rule.
 *
 * ⚖ IT NEVER FABRICATES A RANKING. `hasBand: false` (suppressed below the min-N
 * privacy floor, which is where a founder-only marketplace sits nearly always
 * today) renders a truthful "not enough peers yet" state, exactly as the sibling
 * DemandRadarCard does. A metric with no own value or no band is simply absent —
 * it is not drawn at 0.
 */

const TIER_COPY: Record<NonNullable<MetricBenchmark['tier']>, string> = {
  top: 'Top quarter',
  above_median: 'Above the middle',
  below_median: 'Below the middle',
  bottom: 'Bottom quarter',
};

function formatOwn(metric: MetricBenchmark): string {
  if (metric.own === null) return '—';
  if (metric.key === 'reply_mins') {
    const mins = Math.round(metric.own);
    return mins >= 60 ? `${Math.round(mins / 60)}h` : `${mins}m`;
  }
  return `${Math.round(metric.own)}%`;
}

function formatBandMid(metric: MetricBenchmark): string {
  if (!metric.band) return '—';
  if (metric.key === 'reply_mins') {
    const mins = Math.round(metric.band.p50);
    return mins >= 60 ? `${Math.round(mins / 60)}h` : `${mins}m`;
  }
  return `${Math.round(metric.band.p50)}%`;
}

export function FunnelBenchmarkCard({ benchmark }: { benchmark: FunnelBenchmark }) {
  /* Only metrics that have BOTH an own value and a band can be placed. Drawing a
     marker without one of them would be inventing a position. */
  const placed = benchmark.metrics.filter((m) => m.percentile !== null && m.band !== null);

  if (!benchmark.hasBand || placed.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-ink/15 bg-white p-10 text-center">
        <TrendingUp aria-hidden className="mx-auto h-8 w-8 text-ink/30" strokeWidth={1.5} />
        <p className="mt-3 text-sm font-medium text-ink">
          Not enough shops like yours yet
        </p>
        <p className="mx-auto mt-1 max-w-md text-sm text-ink/55">
          We only compare you against a group big enough that no single shop can
          be picked out of it. As more shops in your category join, this fills in.
        </p>
      </div>
    );
  }

  return (
    <ShopCard pad="none" className="overflow-hidden">
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-ink/10 px-4 py-3">
        <h2 className="text-sm font-semibold text-ink">How you compare</h2>
        <p className="text-xs text-ink/55">
          {benchmark.category ? `${benchmark.category} · ` : ''}
          {benchmark.sampleN} shops like yours
        </p>
      </header>

      <ul className="divide-y divide-ink/5">
        {placed.map((metric) => (
          <li key={metric.key} className="px-4 py-4">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <p className="text-sm font-medium text-ink">{metric.label}</p>
              <p className="text-sm text-ink/70">
                <span className="font-semibold text-ink">{formatOwn(metric)}</span>
                <span className="text-ink/45"> · middle of the field {formatBandMid(metric)}</span>
              </p>
            </div>

            {/* The marker sits on the 0-100 percentile the library already
                computed and orients so RIGHT is always better — including for
                reply time, where a lower raw number is the good one. */}
            <div className="mt-2.5 h-1.5 w-full rounded-full bg-ink/[0.08]">
              <div
                className="relative h-1.5 rounded-full bg-terracotta/70"
                style={{ width: `${Math.max(2, Math.min(100, metric.percentile ?? 0))}%` }}
              />
            </div>

            {metric.tier ? (
              <p className="mt-2 font-mono text-[10px] uppercase tracking-[0.15em] text-ink/55">
                {TIER_COPY[metric.tier]}
              </p>
            ) : null}
          </li>
        ))}
      </ul>

      <div className="flex items-start gap-2 border-t border-ink/10 bg-white/60 px-4 py-3 text-xs text-ink/65">
        <Info aria-hidden className="mt-0.5 h-3.5 w-3.5 shrink-0 text-terracotta" strokeWidth={1.75} />
        <p>
          These are ranges across shops in your category and area — never another
          shop&rsquo;s numbers. A comparison only appears once the group is large
          enough that nobody in it can be identified.
        </p>
      </div>
    </ShopCard>
  );
}
