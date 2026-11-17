/**
 * Vendor badge row — the explore shop card's trust pill.
 *
 * 🏅 ONE PILL NOW (owner, DECISION_LOG 2026-11-15, specs 4b8cc3a3: "the badges we created will be the only badges we
 * have"). The 2026-05-22 pills `new` · `couple_trusted` · `most_booking` · `top_pick` RETIRE as badges; Setnayan Verified
 * stays. The new badges (the five tiered shop badges, the seals, the card medals) reach this card only through the one
 * adapter, `lib/public-badges.ts` — which today has a source for Setnayan Verified alone, so nothing else is drawn (never
 * a fake badge; the gaps are named there).
 *
 * Server component (no interactive state). The tooltip is the native `title` — keyboard + screen-reader reachable.
 */

import { CheckCircle, Snowflake } from 'lucide-react';
import type { VendorBadge } from '@/lib/vendor-badges';
import { keptExplorePills, SEALS } from '@/lib/public-badges';

const VERIFIED_NAME = SEALS.find((s) => s.key === 'verified')!.name;

export function VendorBadgeRow({
  badges,
}: {
  badges: ReadonlyArray<VendorBadge>;
}) {
  const kept = keptExplorePills(badges);
  if (kept.length === 0) return null;
  return (
    <ul aria-label="Supplier trust badges" className="flex flex-wrap gap-1.5" data-explore-pills="">
      {kept.map((key) => (
        <li
          key={key}
          title="Setnayan checked the owner, the business papers and the work. A real business stands behind this name."
          className="inline-flex items-center gap-1 rounded-full border border-success-300/50 bg-success-50 px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.15em] text-success-900"
        >
          <CheckCircle className="h-3 w-3" strokeWidth={2} aria-hidden />
          {VERIFIED_NAME}
        </li>
      ))}
    </ul>
  );
}

/**
 * Off-Season Promos (Wave 5) — standalone "Off-season savings" badge.
 *
 * Kept separate from the 4-badge trust system above (which is enum-driven by
 * `lib/vendor-badges.ts`) because this signal is computed at the service
 * level — a LIVE off-peak offer (`vendor_services.discount_type='off_peak'`
 * with a future expiry) — not from the vendor's trust state. The card renders
 * it from `VendorCardData.off_peak_offer`. Sky-tinted (Snowflake) so it reads
 * as a distinct "seasonal deal" cue, separate from the gold/emerald/rose
 * trust palette.
 */
export function OffSeasonBadge() {
  return (
    <span
      title="This supplier is running a live off-peak discount on one of their services right now."
      className="inline-flex items-center gap-1 rounded-full border border-sky-300/60 bg-sky-50 px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.15em] text-sky-800"
    >
      <Snowflake className="h-3 w-3" strokeWidth={2} aria-hidden />
      Off-season savings
    </span>
  );
}
