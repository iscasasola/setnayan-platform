import Link from 'next/link';
import { Radar, ArrowRight } from 'lucide-react';
import type { DemandRadar } from '@/lib/demand-radar';

/**
 * Inline demand preview for My Performance — the top "looks" couples in the
 * vendor's area are asking for, as scaled bars, plus a compact month-heat strip.
 * Links through to the full /vendor-dashboard/demand radar.
 *
 * Server component (no client JS). Data comes from getVendorDemandRadar(), which
 * is min-N suppressed in SQL, so this preview never exposes a single couple.
 */

export function DemandPreviewCard({ radar }: { radar: DemandRadar }) {
  const looks = radar.looks.slice(0, 5);
  const maxLook = looks.reduce((m, l) => Math.max(m, l.total), 0);
  const months = radar.months.slice(0, 6);
  const maxMonth = months.reduce((m, x) => Math.max(m, x.total), 0);

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold" style={{ color: 'var(--m-ink)' }}>
          Demand radar
          <span
            className="ml-2 font-mono text-[11px] uppercase tracking-[0.15em]"
            style={{ color: 'var(--m-slate-3)' }}
          >
            who&apos;s looking for you
          </span>
        </h2>
        <Link
          href="/vendor-dashboard/demand"
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
        {!radar.hasData ? (
          <div className="flex items-center gap-3 py-2" style={{ color: 'var(--m-slate)' }}>
            <Radar className="h-5 w-5" strokeWidth={1.5} aria-hidden style={{ color: 'var(--m-slate-4)' }} />
            <p className="text-sm">
              Not enough demand signal in your area yet — the radar needs a few
              more couples searching before it can show a trend.
            </p>
          </div>
        ) : (
          <div className="space-y-5">
            {looks.length > 0 && (
              <div>
                <p
                  className="mb-2 font-mono text-[11px] uppercase tracking-[0.15em]"
                  style={{ color: 'var(--m-slate)' }}
                >
                  What they&apos;re asking for
                </p>
                <ul className="space-y-2.5">
                  {looks.map((l) => {
                    const widthPct = Math.max((l.total / maxLook) * 100, 4);
                    return (
                      <li key={l.style} className="flex items-center gap-3">
                        <span
                          className="w-20 shrink-0 truncate text-sm"
                          style={{ color: 'var(--m-ink)' }}
                          title={l.label}
                        >
                          {l.label}
                        </span>
                        <span
                          className="h-2.5 flex-1 overflow-hidden rounded-full"
                          style={{ background: 'color-mix(in srgb, var(--m-ink) 5%, transparent)' }}
                        >
                          <span
                            className="block h-full rounded-full"
                            style={{ width: `${widthPct}%`, background: 'var(--m-orange)' }}
                          />
                        </span>
                        <span
                          className="w-8 shrink-0 text-right font-mono text-xs tabular-nums"
                          style={{ color: 'var(--m-slate)' }}
                        >
                          {l.total}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}

            {months.length > 0 && maxMonth > 0 && (
              <div>
                <p
                  className="mb-2 font-mono text-[11px] uppercase tracking-[0.15em]"
                  style={{ color: 'var(--m-slate)' }}
                >
                  Months heating up
                </p>
                <div className="flex h-12 items-end gap-1.5">
                  {[...months].reverse().map((m) => {
                    const pct = m.total === 0 ? 0 : Math.max((m.total / maxMonth) * 100, 8);
                    return (
                      <div key={m.month} className="flex flex-1 flex-col items-center gap-1">
                        <div className="flex w-full flex-1 items-end">
                          <div
                            className="w-full rounded-t-sm"
                            style={{ height: `${pct}%`, background: 'var(--m-orange-3)' }}
                            title={`${m.label}: ${m.total} signal`}
                          />
                        </div>
                        <span className="font-mono text-[9px] leading-none" style={{ color: 'var(--m-slate-3)' }}>
                          {m.label.slice(0, 3)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
