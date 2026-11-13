import { BadgeCheck } from 'lucide-react';
import type { ReactNode } from 'react';
import { formatCount } from '@/lib/format-number';
import { formatGuestAverage } from '@/lib/guest-reviews';
import type { CardReviews } from '@/lib/service-card-view-model';
import { GuestAtEventPill, ReviewGroupHead, SmallStars } from '@/app/v/[slug]/_components/review-groups';

/**
 * ⭐ A SERVICE CARD'S OWN REVIEWS — prototype 6 Nov § 4 ("one block, under From couples") as split by § 9 ("The card ·
 * two groups"):
 *
 *   FROM THE HOSTS ───   ★★★★★ 5.0 · 1 review        (this card's trusted number — the shop's own filter, per card)
 *                        "the newest words…"
 *                        ✓ Verified booking · A. & M. · Dec 2026
 *   FROM GUESTS ──────   ★★★★★ 4.9 · 40 guests       (their own line — never in the hosts' number)
 *                        [shot] ★★★★★ Gabriel D. [Guest at the event]  "one line"
 *                        + 39 more guests · read all  (→ the shop page's "From guests")
 *
 * Drawn only where a caller read them (the shop page); every other surface's card is unchanged. Never a price.
 * `relative z-10` on the link: the card's stretched doorway covers the card, and "read all" must sit above it.
 *
 * 🃏 `item` (the shop's own grown card only): wraps the ONE review each group shows — the hosts' quote, the guest line —
 * in the sheet's hide control. The numbers are never wrapped: a review hidden on a card still counts.
 */
export function CardReviewsBlock({
  reviews,
  item = (_which, inner) => inner,
}: {
  reviews: CardReviews;
  item?: (which: 'host' | 'guest', inner: ReactNode) => ReactNode;
}) {
  const { hosts, guests } = reviews;
  const more = guests ? Math.max(0, guests.count - (guests.newest ? 1 : 0)) : 0;
  return (
    <div className="mt-3 space-y-2" data-card-reviews="">
      {hosts ? (
        <div data-card-reviews-hosts="">
          <ReviewGroupHead>From the hosts</ReviewGroupHead>
          <div className="mt-1.5 flex items-center gap-2 text-xs">
            <SmallStars value={Math.round(hosts.average)} />
            <span className="font-mono text-ink/60">
              {hosts.average.toFixed(1)} · {formatCount(hosts.count)} review{hosts.count === 1 ? '' : 's'}
            </span>
          </div>
          {hosts.quote || hosts.by
            ? item(
                'host',
                // Spans, not <p>/<div>: on the shop's own card this sits inside the hide <button>.
                <span className="block" data-card-reviews-host-quote="">
                  {hosts.quote ? <q className="mt-1 block text-sm text-ink/80">{hosts.quote}</q> : null}
                  {hosts.by ? (
                    <span className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-ink/65">
                      {hosts.verifiedBooking ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-terracotta/10 px-2 py-0.5 text-[11px] font-medium text-terracotta-700">
                          <BadgeCheck aria-hidden className="h-3 w-3" strokeWidth={2} />
                          Verified booking
                        </span>
                      ) : null}
                      <span>{hosts.verifiedBooking ? `· ${hosts.by}` : hosts.by}</span>
                    </span>
                  ) : null}
                </span>,
              )
            : null}
        </div>
      ) : null}

      {guests ? (
        <div data-card-reviews-guests="">
          <ReviewGroupHead>From guests</ReviewGroupHead>
          <div className="mt-1.5 flex items-center gap-2 text-xs">
            <SmallStars value={Math.round(guests.average)} />
            <span className="font-mono text-ink/60">
              {formatGuestAverage(guests.average)} · {formatCount(guests.count)} guest{guests.count === 1 ? '' : 's'}
            </span>
          </div>
          {guests.newest
            ? item(
                'guest',
                <span className="mt-1.5 block" data-card-reviews-guest-line="">
                  <span className="flex flex-wrap items-center gap-1.5 text-xs">
                    {guests.newest.photoUrl ? (
                      <span className="block h-7 w-7 shrink-0 overflow-hidden rounded-md bg-ink/5">
                        {/* eslint-disable-next-line @next/next/no-img-element -- the guest's own shot, through the blur gate */}
                        <img src={guests.newest.photoUrl} alt="" className="h-full w-full object-cover" />
                      </span>
                    ) : null}
                    <SmallStars value={guests.newest.stars} />
                    <span className="text-sm font-medium text-ink">{guests.newest.shownName}</span>
                    <GuestAtEventPill />
                  </span>
                  {guests.newest.line ? <q className="mt-1 block text-sm text-ink/80">{guests.newest.line}</q> : null}
                </span>,
              )
            : null}
          {more > 0 ? (
            <p className="mt-1.5 text-xs text-ink/60">
              + {formatCount(more)} more guest{more === 1 ? '' : 's'} ·{' '}
              <a href={guests.readAllHref} className="relative z-10 text-link hover:underline" data-card-reviews-read-all="">
                read all
              </a>
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
