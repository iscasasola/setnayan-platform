import { HeartPulse } from 'lucide-react';
import type { VendorHealthComposite } from '@/lib/vendor-health-composite';

/**
 * Business-health composite card — a single vendor-SAFE health read built from
 * five vendor-facing pillars. NEVER surfaces the HQ-internal
 * platform_health_score (see lib/vendor-health-composite.ts).
 */

const BAND_META: Record<
  VendorHealthComposite['band'],
  { label: string; chip: string; ring: string }
> = {
  strong: { label: 'Strong', chip: 'bg-emerald-500/12 text-emerald-700', ring: 'text-emerald-500' },
  steady: { label: 'Steady', chip: 'bg-amber-400/15 text-amber-700', ring: 'text-amber-400' },
  building: { label: 'Building', chip: 'bg-terracotta/12 text-terracotta', ring: 'text-terracotta' },
  no_data: { label: 'Getting started', chip: 'bg-ink/8 text-ink/55', ring: 'text-ink/25' },
};

function pillarBarColor(score: number): string {
  if (score >= 75) return 'bg-emerald-500';
  if (score >= 50) return 'bg-amber-400';
  return 'bg-terracotta';
}

function CompositeRing({
  composite,
  ringColor,
}: {
  composite: number | null;
  ringColor: string;
}) {
  const pct = composite ?? 0;
  const R = 34;
  const C = 2 * Math.PI * R;
  const dash = (pct / 100) * C;
  return (
    <div className="relative h-24 w-24 shrink-0">
      <svg viewBox="0 0 80 80" className="h-24 w-24 -rotate-90">
        <circle cx="40" cy="40" r={R} fill="none" strokeWidth="7" className="stroke-ink/10" />
        <circle
          cx="40"
          cy="40"
          r={R}
          fill="none"
          strokeWidth="7"
          strokeLinecap="round"
          strokeDasharray={`${dash} ${C}`}
          className={ringColor}
          stroke="currentColor"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-semibold tabular-nums text-ink">
          {composite === null ? '—' : composite}
        </span>
        <span className="font-mono text-[9px] uppercase tracking-[0.15em] text-ink/45">
          / 100
        </span>
      </div>
    </div>
  );
}

export function HealthCompositeCard({ health }: { health: VendorHealthComposite }) {
  const band = BAND_META[health.band];

  return (
    <section className="space-y-4">
      <div className="flex items-center gap-2">
        <h2
          className="font-mono text-[11px] uppercase tracking-[0.18em]"
          style={{ color: 'var(--m-slate)' }}
        >
          Business health
        </h2>
        <span
          className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${band.chip}`}
        >
          <HeartPulse className="h-3 w-3" strokeWidth={2} aria-hidden />
          {band.label}
        </span>
      </div>

      <div className="rounded-2xl border border-ink/10 bg-cream p-5">
        <div className="flex items-center gap-5">
          <CompositeRing composite={health.composite} ringColor={band.ring} />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-ink">
              {health.composite === null
                ? 'Your health score fills in as you get inquiries and bookings.'
                : 'A blended read of the five things couples judge you on.'}
            </p>
            <p className="mt-1 text-xs text-ink/55">
              Built only from your own metrics — response rate, reliability,
              reviews, profile strength, and your search-ranking score. Pillars
              without data yet are left out of the average, not counted against
              you.
            </p>
          </div>
        </div>

        {/* Five pillar bars. */}
        <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {health.pillars.map((p) => (
            <div key={p.key} className="rounded-xl border border-ink/8 bg-white/40 p-3">
              <div className="flex items-baseline justify-between">
                <span className="text-xs font-medium text-ink/80">{p.label}</span>
                <span className="font-mono text-sm tabular-nums text-ink">
                  {p.score === null ? '—' : p.score}
                </span>
              </div>
              <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-ink/10">
                {p.score !== null ? (
                  <div
                    className={`h-full rounded-full ${pillarBarColor(p.score)}`}
                    style={{ width: `${p.score}%` }}
                    role="progressbar"
                    aria-valuenow={p.score}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-label={`${p.label}: ${p.score} out of 100`}
                  />
                ) : null}
              </div>
              <p className="mt-1.5 text-[11px] leading-snug text-ink/50">{p.hint}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
