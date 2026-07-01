import Link from 'next/link';
import {
  Rocket,
  Zap,
  ImagePlus,
  Star,
  CalendarDays,
  ArrowRight,
} from 'lucide-react';
import type { GrowthRec, GrowthRecKey, GrowthImpact } from '@/lib/vendor-growth-recs';

/**
 * "Grow your business · highest impact first" — the growth-recommendation block
 * from the My Performance prototype. Each card is derived from the vendor's own
 * gaps (lib/vendor-growth-recs.ts) and carries an impact chip + a routed CTA.
 */

const REC_ICON: Record<GrowthRecKey, React.ReactNode> = {
  reply_faster: <Zap className="h-5 w-5" strokeWidth={1.75} aria-hidden />,
  add_photos: <ImagePlus className="h-5 w-5" strokeWidth={1.75} aria-hidden />,
  ask_reviews: <Star className="h-5 w-5" strokeWidth={1.75} aria-hidden />,
  open_saturdays: <CalendarDays className="h-5 w-5" strokeWidth={1.75} aria-hidden />,
};

function impactChipStyle(impact: GrowthImpact): React.CSSProperties {
  if (impact === 'high') {
    return { background: 'var(--m-orange-4)', color: 'var(--m-orange-2)' };
  }
  if (impact === 'medium') {
    return { background: 'var(--m-sage)', color: 'var(--m-sage-deep)' };
  }
  return {
    background: 'color-mix(in srgb, var(--m-ink) 6%, transparent)',
    color: 'var(--m-slate)',
  };
}

function GrowthCard({ rec }: { rec: GrowthRec }) {
  return (
    <div
      className="flex flex-col rounded-lg border bg-white p-4"
      style={{ borderColor: 'var(--m-line)' }}
    >
      <div className="mb-3 flex items-start justify-between gap-3">
        <span
          aria-hidden
          className="inline-flex h-10 w-10 items-center justify-center rounded-xl"
          style={{ background: 'var(--m-orange-4)', color: 'var(--m-orange-2)' }}
        >
          {REC_ICON[rec.key]}
        </span>
        <span
          className="inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-medium"
          style={impactChipStyle(rec.impact)}
        >
          {rec.impactLabel}
        </span>
      </div>
      <h3 className="text-[15px] font-semibold" style={{ color: 'var(--m-ink)' }}>
        {rec.title}
      </h3>
      <p className="mt-1 flex-1 text-[13px] leading-relaxed" style={{ color: 'var(--m-slate)' }}>
        {rec.body}
      </p>
      <Link
        href={rec.ctaHref}
        className="group mt-3 inline-flex items-center gap-1.5 text-sm font-medium"
        style={{ color: 'var(--m-orange-2)' }}
      >
        {rec.ctaLabel}
        <ArrowRight
          aria-hidden
          className="h-4 w-4 transition-transform group-hover:translate-x-0.5"
          strokeWidth={1.75}
        />
      </Link>
    </div>
  );
}

export function GrowthRecsCard({ recs }: { recs: GrowthRec[] }) {
  return (
    <section className="space-y-4">
      <div className="flex items-center gap-2">
        <Rocket
          aria-hidden
          className="h-5 w-5"
          strokeWidth={1.75}
          style={{ color: 'var(--m-orange-2)' }}
        />
        <h2 className="text-lg font-semibold" style={{ color: 'var(--m-ink)' }}>
          Grow your business
        </h2>
        <span
          className="font-mono text-[11px] uppercase tracking-[0.15em]"
          style={{ color: 'var(--m-slate-3)' }}
        >
          Highest impact first
        </span>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {recs.map((rec) => (
          <GrowthCard key={rec.key} rec={rec} />
        ))}
      </div>
    </section>
  );
}
