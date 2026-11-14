import Link from 'next/link';
import { LifeBuoy, ChevronRight, MapPin } from 'lucide-react';
import { ActionButton } from '@/components/action-button';
import { InfoTip } from '@/app/_components/info-tip';
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

  // 📐 DESIGN TEMPLATE (14 Nov 2026, rules 2 · 3 · 7 · 13): no box — grey capitals; the explaining line sits behind the
  // ⓘ; each same-day supplier is one hairline row with a terracotta › (no bordered tiles); the door is the shared pill.
  return (
    <section aria-labelledby="day-of-get-help" className="space-y-2">
      <h2 id="day-of-get-help" className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.06em] text-ink/70">
        <LifeBuoy aria-hidden className="h-3.5 w-3.5 text-terracotta" strokeWidth={2} />
        Get help
      </h2>

      <InfoTip
        label="Something not right?"
        labelAs="h3"
        labelClassName="text-base font-semibold tracking-tight text-ink"
        align="start"
      >
        {hasShortlist
          ? 'Need someone today? These verified suppliers take same-day work — nearest you first.'
          : 'If a supplier is a no-show or you need a hand on the day, reach your coordinator or the Setnayan team — we will help you sort it.'}
      </InfoTip>

      {hasShortlist ? (
        <>
          <ul className="divide-y divide-ink/10">
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
                    <span className="block truncate text-[15px] font-semibold text-ink">{v.name}</span>
                    {meta ? (
                      <span className="flex items-center gap-1 text-[13px] text-ink/75">
                        {v.distanceKm != null ? (
                          <MapPin aria-hidden className="h-3 w-3" strokeWidth={2} />
                        ) : null}
                        {meta}
                      </span>
                    ) : null}
                  </span>
                  {href ? (
                    <ChevronRight aria-hidden className="h-4 w-4 shrink-0 text-terracotta" strokeWidth={2} />
                  ) : null}
                </>
              );
              return (
                <li key={v.vendorProfileId}>
                  {href ? (
                    <Link href={href} className="flex min-h-14 items-center justify-between gap-3 py-2">
                      {inner}
                    </Link>
                  ) : (
                    <div className="flex min-h-14 items-center justify-between gap-3 py-2">{inner}</div>
                  )}
                </li>
              );
            })}
          </ul>
          <p className="text-[13px] text-ink/75">
            Still stuck? Reach your coordinator or the Setnayan team.
          </p>
        </>
      ) : null}

      <ActionButton
        tone="info"
        href="/help"
        icon={<LifeBuoy aria-hidden strokeWidth={1.9} />}
        label="Get help"
      />
    </section>
  );
}
