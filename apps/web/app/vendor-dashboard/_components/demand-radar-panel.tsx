import { Radar, Info } from 'lucide-react';
import type { DemandRadar } from '@/lib/demand-radar';
import { DemandRadarCard } from '../demand/_components/demand-radar-card';

/**
 * DemandRadarPanel — the SHARED, full-detail Demand Radar body.
 *
 * One source of truth for the "where demand is building" surface. Rendered by
 * BOTH:
 *   • the standalone route /vendor-dashboard/demand (variant="page")
 *   • the vendor Overview's inline Demand Radar section (variant="section")
 *
 * Presentational only — the caller does the (role-scoped) data fetch and passes
 * the assembled `radar` in. This never re-derives suppression (the SQL RPC owns
 * that) and never fabricates data: an empty/suppressed radar renders the honest
 * "not enough demand data yet" state from DemandRadarCard.
 *
 * Editorial `--m-*` palette throughout (Alabaster / Obsidian / Champagne),
 * matching the vendor Overview.
 */
export function DemandRadarPanel({
  radar,
  marketLabel,
  scope = 'vendor',
  variant = 'page',
}: {
  radar: DemandRadar;
  marketLabel: string | null;
  scope?: 'vendor' | 'admin';
  /** 'page' = standalone route (h1 hero header) · 'section' = inline Overview block (h2). */
  variant?: 'page' | 'section';
}) {
  const Heading = variant === 'page' ? 'h1' : 'h2';

  return (
    <div className="space-y-6">
      {variant === 'page' ? (
        <header className="space-y-3">
          <span
            className="inline-flex h-10 w-10 items-center justify-center rounded-lg"
            style={{ background: 'var(--m-orange-4)', color: 'var(--m-orange-2)' }}
          >
            <Radar aria-hidden className="h-5 w-5" strokeWidth={1.75} />
          </span>
          <p className="m-label-mono" style={{ color: 'var(--m-slate-3)' }}>
            Vendor dashboard · Demand Radar
          </p>
          <Heading
            className="text-3xl font-semibold tracking-tight sm:text-4xl"
            style={{ color: 'var(--m-ink)' }}
          >
            Demand Radar
          </Heading>
          <p className="max-w-prose text-base" style={{ color: 'var(--m-slate)' }}>
            Where the demand is building in{' '}
            <span className="font-medium" style={{ color: 'var(--m-ink)' }}>
              {marketLabel ?? 'your area'}
            </span>{' '}
            — by month, and by the looks couples are choosing. It&rsquo;s a
            bird&rsquo;s-eye read of your market to help you plan where to focus,
            built only from de-identified totals. We never show you a single
            couple or any one plan.
          </p>
        </header>
      ) : (
        <div className="space-y-1.5">
          <Heading
            className="flex items-center gap-2 text-lg font-semibold"
            style={{ color: 'var(--m-ink)' }}
          >
            <Radar
              aria-hidden
              className="h-5 w-5"
              strokeWidth={1.75}
              style={{ color: 'var(--m-orange-2)' }}
            />
            Demand Radar
          </Heading>
          <p className="text-sm" style={{ color: 'var(--m-slate)' }}>
            Where demand is building in{' '}
            <span className="font-medium" style={{ color: 'var(--m-ink)' }}>
              {marketLabel ?? 'your area'}
            </span>{' '}
            — by month and by the looks couples are choosing. De-identified
            totals only; never a single couple.
          </p>
        </div>
      )}

      <article
        className="flex items-start gap-3 rounded-xl border p-4 text-sm"
        style={{ borderColor: 'var(--m-line)', background: 'var(--m-paper-2)' }}
      >
        <Info
          aria-hidden
          className="mt-0.5 h-4 w-4 shrink-0"
          strokeWidth={1.75}
          style={{ color: 'var(--m-orange-2)' }}
        />
        <div className="space-y-1">
          <p className="font-medium" style={{ color: 'var(--m-ink)' }}>
            How Demand Radar protects privacy
          </p>
          <p className="text-sm" style={{ color: 'var(--m-slate)' }}>
            Every number here is a <span className="font-medium">count</span> —
            inquiries, paid unlocks, and bookings rolled up by month and look for
            your region. Small groups are hidden until there are enough of them
            that no single couple can be picked out. That&rsquo;s why the radar
            can look quiet early on — it fills in as your market grows.
          </p>
        </div>
      </article>

      <DemandRadarCard radar={radar} marketLabel={marketLabel} scope={scope} />
    </div>
  );
}
