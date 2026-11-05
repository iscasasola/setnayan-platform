import { Star } from 'lucide-react';
import { InfoTip } from '@/app/_components/info-tip';
import { formatCount } from '@/lib/format-number';
import { formatStarRating } from '@/lib/reviews';
import type { PublicGuestRatings } from '@/lib/supplier-scan.server';

/**
 * ⭐ GUEST RATINGS — the supplier's public page, in THEIR OWN section after the couple reviews (owner 2026-11-05:
 * *"separate"*). A guest rates a service only after the supplier's scanner marked their item received at an event,
 * and only the ratings Setnayan published reach this page. The couple reviews' average is never mixed with this one,
 * so a shop's booking reputation and its on-the-day giveaways are read apart.
 *
 * Draws nothing when none are published, and nothing when the read failed (`ratings === null`, logged by the read):
 * a public page makes no claim either way. The guest and the event are never shown.
 */
export function GuestRatingsSection({ ratings, businessName }: { ratings: PublicGuestRatings | null; businessName: string }) {
  if (!ratings || ratings.count === 0) return null;
  return (
    <section id="guest-ratings" aria-labelledby="guest-ratings-h" className="space-y-4 border-b border-ink/10 py-8" data-guest-ratings="">
      <h2 id="guest-ratings-h" className="sr-only">
        Guest ratings
      </h2>
      <div className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink/55">
        <InfoTip label="Guest ratings" align="start">
          Guests at an event rate what {businessName} handed them — a print, a souvenir, a photo — after it was scanned as
          received. Setnayan reads each one before it shows here. These are kept apart from the couples&rsquo; reviews
          above.
        </InfoTip>
      </div>
      <p className="flex items-center gap-1.5 text-[15px] text-ink">
        <Star aria-hidden className="h-4 w-4 fill-warn-400 text-warn-500" strokeWidth={1.5} />
        <span className="font-semibold tabular-nums">{formatStarRating(ratings.average)}</span>
        <span className="text-ink/60">
          · {formatCount(ratings.count)} guest rating{ratings.count === 1 ? '' : 's'}
        </span>
      </p>
      {ratings.lines.length > 0 ? (
        <ul className="divide-y divide-ink/10">
          {ratings.lines.map((r) => (
            <li key={r.reviewId} className="py-3">
              <p className="text-[15px] text-ink">&ldquo;{r.line}&rdquo;</p>
              <p className="mt-0.5 text-[13px] text-ink/60">
                <span aria-label={`${r.stars} of 5 stars`}>{'★'.repeat(r.stars)}</span>
                {r.service ? ` · ${r.service}` : null}
              </p>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
