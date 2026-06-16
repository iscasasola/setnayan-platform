import Link from 'next/link';
import { LifeBuoy, ArrowRight, MapPin } from 'lucide-react';
import { formatDistanceKm } from '@/lib/geo';
import type { SameDayVendor } from '@/lib/same-day-vendors';

/**
 * Get-help card (Event Lifecycle Menu · day-of grid). Two layers, spec §4:
 *
 *  1. **Same-day shortlist** (PR5) — a few VERIFIED, PAID vendors who opted into
 *     same-day work, nearest the venue first. The couple can tap through to a
 *     vendor's profile to reach out. Surfaces only when at least one vendor has
 *     opted in; computed server-side in the day-of page and passed down.
 *  2. **Escalation floor** — if nothing fits (or no one opted in), this always
 *     routes to help/support so the card never dead-ends. In-app chat is async
 *     (one message, then blocked until a paid vendor accepts; no SMS in V1), so
 *     escalating to the coordinator + Setnayan team is the reliable path.
 *
 * Real same-day BOOKING is V1.5 — V1 is filter + escalation only.
 */
export function GetHelpCard({ sameDayVendors = [] }: { sameDayVendors?: SameDayVendor[] }) {
  const hasShortlist = sameDayVendors.length > 0;

  return (
    <article className="space-y-3 rounded-2xl border border-ink/10 bg-white p-5 shadow-sm">
      <header className="flex items-center justify-between">
        <p className="inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.18em] text-ink/55">
          <LifeBuoy aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
          Get help
        </p>
      </header>

      <h3 className="text-base font-semibold tracking-tight text-ink">Something not right?</h3>

      {hasShortlist ? (
        <>
          <p className="text-sm text-ink/55">
            Need someone today? These verified vendors take same-day work — nearest you first.
          </p>
          <ul className="space-y-2">
            {sameDayVendors.map((v) => {
              const where =
                v.distanceKm != null
                  ? formatDistanceKm(v.distanceKm)
                  : v.locationCity ?? v.region ?? null;
              const service = v.services?.[0] ?? null;
              const meta = [service, where].filter(Boolean).join(' · ');
              const href = v.slug ? `/v/${v.slug}` : null;
              const inner = (
                <>
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium text-ink">{v.name}</span>
                    {meta ? (
                      <span className="flex items-center gap-1 text-xs text-ink/50">
                        {v.distanceKm != null ? (
                          <MapPin aria-hidden className="h-3 w-3" strokeWidth={2} />
                        ) : null}
                        {meta}
                      </span>
                    ) : null}
                  </span>
                  {href ? (
                    <ArrowRight
                      aria-hidden
                      className="h-4 w-4 shrink-0 text-ink/40"
                      strokeWidth={2}
                    />
                  ) : null}
                </>
              );
              return (
                <li key={v.vendorProfileId}>
                  {href ? (
                    <Link
                      href={href}
                      className="flex items-center justify-between gap-3 rounded-xl border border-ink/10 px-3 py-2 transition-colors hover:border-terracotta/40 hover:bg-terracotta/[0.03]"
                    >
                      {inner}
                    </Link>
                  ) : (
                    <div className="flex items-center justify-between gap-3 rounded-xl border border-ink/10 px-3 py-2">
                      {inner}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
          <p className="text-xs text-ink/45">
            Still stuck? Reach your coordinator or the Setnayan team.
          </p>
        </>
      ) : (
        <p className="text-sm text-ink/55">
          If a vendor is a no-show or you need a hand on the day, reach your coordinator or the
          Setnayan team — we will help you sort it.
        </p>
      )}

      <Link
        href="/help"
        className="inline-flex items-center gap-1.5 rounded-full bg-terracotta/10 px-3 py-1.5 text-xs font-medium text-terracotta-700 transition-colors hover:bg-terracotta/20"
      >
        Get help
        <ArrowRight aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
      </Link>
    </article>
  );
}
