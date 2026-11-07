import type { CardHostReviewStats } from '@/lib/reviews';
import type { GuestReviewRow, GuestReviewStats } from '@/lib/guest-reviews';
import type { CardReviews } from '@/lib/service-card-view-model';

/**
 * ⭐ A SERVICE CARD'S OWN REVIEWS, assembled (prototype 6 Nov § 4 / § 9). Pure, so the shape is tested directly.
 *
 *   hosts  — the card's trusted number (`vendor_service_trusted_review_stats`); the quote + by-line come from the newest
 *            host review on this card that the page already loaded (none in the window → the number alone, never a
 *            borrowed quote from another card).
 *   guests — the guests' own number for this card (`vendor_guest_review_service_stats`) and the newest guest row the
 *            page already loaded; "read all" → the shop page's "From guests".
 * A refused stats read (`null`) draws NO line of that kind on any card — never "0 reviews" over a card that has some.
 */

/** "[the first words of the review]" — clipped at a word, like the prototype's 120-character quote. */
export function clipQuote(body: string | null | undefined, max = 120): string | null {
  const t = (body ?? '').trim();
  if (!t) return null;
  if (t.length <= max) return t;
  const cut = t.slice(0, max);
  const at = cut.lastIndexOf(' ');
  return `${(at > 40 ? cut.slice(0, at) : cut).trimEnd()}…`;
}

/** "Dec 2026" in Manila — the month a review was written. */
export function monthYear(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('en-US', { month: 'short', year: 'numeric', timeZone: 'Asia/Manila' });
}

export type CardHostReviewLike = {
  service_id?: string | null;
  body: string | null;
  created_at: string;
  /** Already the couple's "Shown as" (`shownCoupleName`). */
  couple_display_name: string | null;
  booked_through_setnayan: boolean;
};

export function buildCardReviews(input: {
  serviceIds: ReadonlyArray<string>;
  hostStats: ReadonlyMap<string, CardHostReviewStats> | null;
  guestStats: ReadonlyMap<string, GuestReviewStats> | null;
  hostReviews: ReadonlyArray<CardHostReviewLike>;
  guestRows: ReadonlyArray<GuestReviewRow>;
  guestPhotoUrls: ReadonlyMap<string, string>;
  readAllHref: string;
}): Map<string, CardReviews> {
  const out = new Map<string, CardReviews>();
  const newestFirst = <T extends { created_at: string }>(xs: ReadonlyArray<T>) =>
    [...xs].sort((a, b) => b.created_at.localeCompare(a.created_at));
  const hostsNewest = newestFirst(input.hostReviews);
  const guestsNewest = newestFirst(input.guestRows);

  for (const id of input.serviceIds) {
    const hs = input.hostStats?.get(id) ?? null;
    const gs = input.guestStats?.get(id) ?? null;
    let hosts: CardReviews['hosts'] = null;
    if (hs && hs.count > 0) {
      const withWords = hostsNewest.find((r) => r.service_id === id && clipQuote(r.body));
      hosts = {
        count: hs.count,
        average: hs.average,
        quote: withWords ? clipQuote(withWords.body) : null,
        by: withWords
          ? [withWords.couple_display_name?.trim() || 'Verified couple', monthYear(withWords.created_at)].filter(Boolean).join(' · ')
          : null,
        verifiedBooking: Boolean(withWords?.booked_through_setnayan),
      };
    }
    let guests: CardReviews['guests'] = null;
    if (gs && gs.count > 0) {
      const g = guestsNewest.find((r) => r.service_id === id) ?? null;
      guests = {
        count: gs.count,
        average: gs.average,
        newest: g
          ? {
              shownName: g.shown_name,
              stars: g.rating_overall,
              line: g.line,
              photoUrl: g.capture_id ? (input.guestPhotoUrls.get(g.capture_id) ?? null) : null,
            }
          : null,
        readAllHref: input.readAllHref,
      };
    }
    if (hosts || guests) out.set(id, { hosts, guests });
  }
  return out;
}
