import Link from 'next/link';
import { Filter, ArrowRight } from 'lucide-react';
import type { FunnelStep } from '@/lib/vendor-funnel';

/**
 * Inline funnel preview for My Performance — the four-stage
 * views → inquiries → quotes → booked bar cascade, each bar scaled to the top
 * stage (profile views) so the drop-off is visible at a glance. Links through
 * to the full /vendor-dashboard/funnel surface for the sliced breakdown.
 *
 * Server component (no client JS). Data comes from the shared
 * fetchVendorFunnelTotals() + buildFunnelSteps() so this preview and the full
 * page never disagree on what "booked" means.
 */

function conv(part: number, whole: number): string | null {
  if (whole <= 0) return null;
  return `${Math.round((part / whole) * 100)}%`;
}

export function FunnelPreviewCard({
  steps,
  windowLabel,
}: {
  steps: FunnelStep[];
  windowLabel: string;
}) {
  const top = steps[0]?.count ?? 0;
  const hasData = top > 0;

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold" style={{ color: 'var(--m-ink)' }}>
          Where bookings come from
          <span
            className="ml-2 font-mono text-[11px] uppercase tracking-[0.15em]"
            style={{ color: 'var(--m-slate-3)' }}
          >
            {windowLabel}
          </span>
        </h2>
        <Link
          href="/vendor-dashboard/funnel"
          className="group inline-flex items-center gap-1 text-sm font-medium"
          style={{ color: 'var(--m-orange-2)' }}
        >
          Details
          <ArrowRight
            className="h-4 w-4 transition-transform group-hover:translate-x-0.5"
            strokeWidth={1.75}
            aria-hidden
          />
        </Link>
      </div>

      <div className="rounded-lg border bg-white p-5" style={{ borderColor: 'var(--m-line)' }}>
        {!hasData ? (
          <div className="flex items-center gap-3 py-2" style={{ color: 'var(--m-slate)' }}>
            <Filter className="h-5 w-5" strokeWidth={1.5} aria-hidden style={{ color: 'var(--m-slate-4)' }} />
            <p className="text-sm">No profile views {windowLabel} yet — your funnel fills in as couples find you.</p>
          </div>
        ) : (
          <ul className="space-y-3">
            {steps.map((s, i) => {
              const widthPct = Math.max((s.count / top) * 100, s.count > 0 ? 4 : 0);
              // Step-to-step conversion (this stage ÷ the stage above it).
              const prev = i > 0 ? (steps[i - 1]?.count ?? null) : null;
              const rate = prev != null ? conv(s.count, prev) : null;
              return (
                <li key={s.label}>
                  <div className="mb-1 flex items-baseline justify-between gap-2">
                    <span className="text-sm font-medium" style={{ color: 'var(--m-ink)' }}>
                      {s.label}
                    </span>
                    <span className="flex items-baseline gap-2">
                      {rate && (
                        <span className="font-mono text-[11px]" style={{ color: 'var(--m-orange-2)' }}>
                          {rate}
                        </span>
                      )}
                      <span className="font-mono text-sm tabular-nums" style={{ color: 'var(--m-ink)' }}>
                        {s.count.toLocaleString('en-PH')}
                      </span>
                    </span>
                  </div>
                  <div
                    className="h-2.5 w-full overflow-hidden rounded-full"
                    style={{ background: 'color-mix(in srgb, var(--m-ink) 5%, transparent)' }}
                  >
                    <div
                      className="h-full rounded-full"
                      style={{ width: `${widthPct}%`, background: 'var(--m-orange)' }}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}
