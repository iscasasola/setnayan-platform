/**
 * ⭐ THE SHOP'S ONE RATING (L6 · S2, walk 27 Nov 2026: Shop › Analytics said 4.2 ★ — `vendor_activity_stats`'
 * `review_avg_bayesian`, an average pulled toward a prior for ranking — while Your page said 4.7 ★ off the raw
 * `vendor_review_stats`, and the public shop page drew no stars at all).
 *
 * THE ONE SOURCE is the trusted aggregate, `vendor_trusted_review_stats` (`trusted_avg_rating` · `trusted_review_count`;
 * `fetchTrustedReviewStatsRead` in `lib/reviews.ts`). The anti-fraud spec (`Anti_Fraud_Trust_Integrity_2026-07-05` § 3)
 * makes it the ONLY source the public headline rating may read: reviews booked through Setnayan, at arm's length. The
 * supplier's own dashboard now says the same number couples are shown, so the shop never sees a rating couples cannot.
 * The Bayesian average stays where it belongs — ranking and the health score — and is never printed as "your rating".
 *
 * PURE: the readers hand in the trusted row (or null for a refused read); this decides what is said.
 *   · null (the read was refused)                 → `unread` — "Couldn’t load", never "No reviews yet"
 *   · no trusted review, or an average of 0       → `none`   — "No reviews yet"
 *   · a count and an average                      → `rated`  — "4.7 ★ · 12 reviews"
 * 🔒 lib/shop-rating.test.ts
 */
import { formatCount } from '@/lib/format-number';

export type TrustedRatingRow = { trusted_avg_rating: number | string | null; trusted_review_count: number | string | null };

export type ShopRating =
  | { state: 'unread' }
  | { state: 'none' }
  | { state: 'rated'; average: number; count: number };

export function shopRatingOf(row: TrustedRatingRow | null | undefined): ShopRating {
  if (row == null) return { state: 'unread' };
  const count = Number(row.trusted_review_count ?? 0);
  const average = Number(row.trusted_avg_rating ?? 0);
  if (!Number.isFinite(count) || !Number.isFinite(average) || count <= 0 || average <= 0) return { state: 'none' };
  return { state: 'rated', average, count };
}

/** "4.7" — one decimal, the way every star figure reads. Null unless rated. */
export function shopRatingFigure(r: ShopRating): string | null {
  return r.state === 'rated' ? r.average.toFixed(1) : null;
}

/** "12 reviews" · "1 review" — null unless rated. */
export function shopRatingCountWords(r: ShopRating): string | null {
  return r.state === 'rated' ? `${formatCount(r.count)} ${r.count === 1 ? 'review' : 'reviews'}` : null;
}

/** "4.7 ★ · 12 reviews" · "No reviews yet" · "Couldn’t load". */
export function shopRatingWords(r: ShopRating): string {
  if (r.state === 'unread') return 'Couldn’t load';
  if (r.state === 'none') return 'No reviews yet';
  return `${shopRatingFigure(r)} ★ · ${shopRatingCountWords(r)}`;
}
