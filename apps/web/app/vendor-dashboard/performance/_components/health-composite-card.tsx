'use client';

import { useState, type ReactNode } from 'react';
import { ArrowUpRight, ChevronDown } from 'lucide-react';
import type {
  VendorHealthComposite,
  HealthPillar,
} from '@/lib/vendor-health-composite';
import { pillarBand } from '@/lib/vendor-health-composite';

/**
 * Business-health card — the SIGNATURE surface of My Performance. A dark
 * (--m-ink) card with a champagne-gold composite ring + five vendor-SAFE pillar
 * bars. It NEVER surfaces the HQ-internal platform_health_score (see
 * lib/vendor-health-composite.ts) — this is a rollup of the vendor's own public
 * metrics only.
 *
 * Pillar bar color follows the prototype thresholds: red < 70, amber 70–85,
 * green > 85. Pillars without data yet render as an empty track + "—".
 *
 * Tapping the card smoothly expands/collapses `children` (the growth recs)
 * below it — collapsed by default (and re-collapsed on every load; no persisted
 * state) so the cockpit opens on the health snapshot alone. The reveal animates
 * via a grid-template-rows 0fr↔1fr + opacity transition; the tray is `inert`
 * while collapsed so its CTAs stay out of the tab order.
 */

/** Gold ring — champagne-gold sweep on a faint track, over the dark card. */
function CompositeRing({
  composite,
  label,
}: {
  composite: number | null;
  label: string;
}) {
  const pct = composite ?? 0;
  const R = 52;
  const C = 2 * Math.PI * R;
  const dash = (pct / 100) * C;
  return (
    <div className="relative h-36 w-36 shrink-0">
      <svg viewBox="0 0 128 128" className="h-36 w-36 -rotate-90">
        <circle
          cx="64"
          cy="64"
          r={R}
          fill="none"
          strokeWidth="9"
          stroke="rgba(255,255,255,0.12)"
        />
        <circle
          cx="64"
          cy="64"
          r={R}
          fill="none"
          strokeWidth="9"
          strokeLinecap="round"
          strokeDasharray={`${dash} ${C}`}
          stroke="var(--m-orange)"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-mono text-4xl font-bold text-white">
          {composite === null ? '—' : composite}
        </span>
        <span
          className="mt-1 font-mono text-[10px] font-semibold uppercase tracking-[0.2em]"
          style={{ color: 'var(--m-orange-3)' }}
        >
          {label}
        </span>
      </div>
    </div>
  );
}

/** One pillar bar, colored by the red/amber/green band over the dark card. */
function PillarBar({ pillar }: { pillar: HealthPillar }) {
  const band = pillarBand(pillar.score);
  const barColor =
    band === 'green'
      ? 'var(--m-sage-deep)'
      : band === 'amber'
        ? 'var(--m-orange)'
        : band === 'red'
          ? 'var(--m-blush-deep)'
          : 'rgba(255,255,255,0.2)';
  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between gap-2">
        <span className="text-[13px] font-medium text-white/80">
          {pillar.label}
        </span>
        <span className="font-mono text-sm tabular-nums text-white/90">
          {pillar.score === null ? '—' : pillar.score}
        </span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
        {pillar.score !== null ? (
          <div
            className="h-full rounded-full"
            style={{ width: `${pillar.score}%`, background: barColor }}
            role="progressbar"
            aria-valuenow={pillar.score}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={`${pillar.label}: ${pillar.score} out of 100`}
          />
        ) : null}
      </div>
      <p className="mt-1 text-[11px] leading-snug text-white/45">
        {pillar.hint}
      </p>
    </div>
  );
}

export function HealthCompositeCard({
  health,
  monthDelta,
  children,
}: {
  health: VendorHealthComposite;
  /** Change in composite vs last month, or null when there's no prior snapshot. */
  monthDelta: number | null;
  /** Growth recs — hidden until the card is tapped. */
  children?: ReactNode;
}) {
  const [expanded, setExpanded] = useState(false);

    // Glass PR-7: the My Performance focal, retuned from solid --m-ink to the
    // `.sn-tile-dark` obsidian-glass recipe (§ 1.3 · the one sanctioned dark tile
    // on this view). Padding stays on the inner button/tray, so we apply the
    // recipe's surface here rather than the padded utility class.
  return (
    <section
      className="rounded-tile"
      style={{
        background:
          'radial-gradient(70% 60% at 85% -10%, rgba(203,167,102,.16), transparent 60%), var(--sn-glass-dark-bg)',
        border: '1px solid var(--sn-glass-dark-line)',
        backdropFilter: 'blur(22px) saturate(1.4)',
        WebkitBackdropFilter: 'blur(22px) saturate(1.4)',
        boxShadow: '0 26px 50px -28px rgba(23,22,15,.7)',
      }}
    >
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
        className="w-full rounded-tile p-6 text-left sm:p-8"
      >
        <div className="flex flex-col gap-6 sm:flex-row sm:items-center">
          <CompositeRing composite={health.composite} label={health.bandLabel} />

          <div className="min-w-0 flex-1">
            <p
              className="font-mono text-[11px] uppercase tracking-[0.2em]"
              style={{ color: 'var(--m-orange-3)' }}
            >
              Business health
            </p>
            <div className="mt-1.5 flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <h2 className="text-xl font-semibold text-white sm:text-2xl">
                How your shop is doing
              </h2>
              {monthDelta !== null && monthDelta !== 0 ? (
                <span
                  className="inline-flex items-center gap-1 text-sm font-medium"
                  style={{
                    color:
                      monthDelta > 0 ? 'var(--m-sage)' : 'var(--m-blush)',
                  }}
                >
                  <ArrowUpRight
                    aria-hidden
                    className={`h-4 w-4 ${monthDelta > 0 ? '' : 'rotate-90'}`}
                    strokeWidth={2}
                  />
                  {monthDelta > 0 ? '+' : ''}
                  {monthDelta} this month
                </span>
              ) : null}
            </div>
            <p className="mt-2 max-w-prose text-sm leading-relaxed text-white/65">
              {health.coaching}
            </p>
          </div>

          {children ? (
            <ChevronDown
              aria-hidden
              className={`h-5 w-5 shrink-0 self-start text-white/40 transition-transform sm:self-center ${expanded ? 'rotate-180' : ''}`}
              strokeWidth={1.75}
            />
          ) : null}
        </div>

        {/* Five pillar bars. */}
        <div className="mt-7 grid grid-cols-1 gap-x-6 gap-y-5 sm:grid-cols-2 lg:grid-cols-5">
          {health.pillars.map((p) => (
            <PillarBar key={p.key} pillar={p} />
          ))}
        </div>

        <p className="mt-6 text-[11px] leading-snug text-white/40">
          Built only from your own metrics — response rate, reviews, conversion,
          and delivery. Pillars without data yet are left out of the average, not
          counted against you.
        </p>
      </button>

      {children ? (
        <div
          className="grid transition-[grid-template-rows] duration-500 ease-in-out motion-reduce:transition-none"
          style={{ gridTemplateRows: expanded ? '1fr' : '0fr' }}
        >
          <div
            inert={!expanded}
            className={`min-h-0 overflow-hidden transition-opacity duration-300 motion-reduce:transition-none ${
              expanded ? 'opacity-100' : 'opacity-0'
            }`}
          >
            <div className="px-6 pb-6 sm:px-8 sm:pb-8">{children}</div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
