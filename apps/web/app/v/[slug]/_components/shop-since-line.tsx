import type { ReactNode } from 'react';
import { BadgeCheck, Store } from 'lucide-react';
import { IN_BUSINESS_SINCE_LABEL, ON_SETNAYAN_SINCE_LABEL } from '@/lib/in-business-since';
import type { EventsByKind } from '@/lib/shop-events-by-kind';
import { EventsByKindButton } from './events-by-kind';

/**
 * The shop page's one "since" fact line (supplier website by plan, owner-approved 2026-10-30):
 *
 *   In business since 2019 ✓ · 120+ events › · On Setnayan since Oct 2026
 *
 * 🗓 "SINCE" IS TWO FACTS (owner 2026-10-29, v13 note 1): their OWN start year (`in_business_since_year`, ✓ when an
 * admin checked it against the DTI registration, else "self-reported" — the shipped pill's two states) and the month
 * the shop opened HERE (`created_at`). The words come from `lib/in-business-since.ts`, the one place both are phrased,
 * so this line and Your details cannot drift. It replaces the shipped "N yrs in business · N+ weddings" pill and the
 * separate "On the marketplace since …" line — nothing they said is lost: the years are the year, and the declared
 * wedding count lives inside "N events ›" (lib/shop-events-by-kind.ts).
 *
 * A part that was never measured is left out with its dot; nothing at all → nothing drawn.
 */
export function ShopSinceLine({
  sinceYear,
  sinceVerified,
  events,
  onSetnayanSince,
  shopName,
}: {
  sinceYear: number | null;
  sinceVerified: boolean;
  events: EventsByKind | null;
  /** "Oct 2026" (`onSetnayanSinceLine`), or null when the stamp is unreadable. */
  onSetnayanSince: string | null;
  shopName: string;
}) {
  const parts: ReactNode[] = [];
  if (sinceYear !== null) {
    parts.push(
      <span key="since" className="inline-flex items-center gap-1">
        <span className="font-medium text-ink">
          {IN_BUSINESS_SINCE_LABEL} {sinceYear}
        </span>
        {sinceVerified ? (
          <BadgeCheck
            aria-label="Verified against the supplier’s DTI registration"
            className="h-3.5 w-3.5 text-success-700"
            strokeWidth={2}
          />
        ) : (
          <span className="text-ink/45">self-reported</span>
        )}
      </span>,
    );
  }
  if (events) parts.push(<EventsByKindButton key="events" events={events} shopName={shopName} />);
  if (onSetnayanSince) {
    parts.push(
      <span key="here">
        {ON_SETNAYAN_SINCE_LABEL} {onSetnayanSince}
      </span>,
    );
  }
  if (parts.length === 0) return null;
  return (
    <p data-shop-since-line="" className="flex flex-wrap items-center gap-x-1.5 text-sm text-ink/70">
      <Store aria-hidden className="h-3.5 w-3.5 shrink-0 text-ink/50" strokeWidth={1.75} />
      {/* The dot travels WITH the part after it, so a wrapped line never ends on a dangling "·". */}
      {parts.map((p, i) =>
        i === 0 ? (
          p
        ) : (
          <span key={`part-${i}`} className="inline-flex items-center gap-x-1.5">
            <span aria-hidden className="text-ink/35">
              ·
            </span>
            {p}
          </span>
        ),
      )}
    </p>
  );
}
