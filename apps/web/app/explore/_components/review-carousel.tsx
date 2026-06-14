'use client';

/**
 * Compact 3-review carousel for the marketplace VendorCard.
 *
 * Per the 2026-05-22 owner directive: the quick-view content per vendor
 * card includes a "Carousel of reviews". Mobile shows 1 visible card,
 * tablet+ shows 3 visible cards at once — no scroll-snap horizontal
 * paging once the desktop layout fits all three; the prev/next buttons
 * surface as visual affordances on mobile only (where they advance the
 * single-visible index).
 *
 * Why a client component:
 *   - Index state lives in React; the buttons advance / decrement.
 *   - Mobile carousel needs `aria-live` updates as the visible review
 *     changes; that's a client concern.
 *   - The desktop "show 3 side-by-side" branch renders all 3 at once
 *     so on lg+ screens the carousel is functionally static — the
 *     buttons hide via `lg:hidden`.
 *
 * Empty / single-review handling:
 *   - 0 reviews: parent should not render the carousel at all (we
 *     return null defensively so a buggy caller doesn't surface a
 *     blank surface).
 *   - 1 review: shows the single card, hides buttons.
 *   - 2 reviews: shows both on lg+, single-card-w/-buttons on <lg.
 */

import { useState } from 'react';
import { ChevronLeft, ChevronRight, Star } from 'lucide-react';
import type { VendorReviewPreview } from '@/lib/vendor-reviews-preview';
import { formatStarRating } from '@/lib/reviews';

type Props = {
  reviews: ReadonlyArray<VendorReviewPreview>;
  /** Tag the carousel for screen readers — pulled from the vendor's
   *  business_name at the parent level. */
  vendorName: string;
};

const BODY_PREVIEW_CHARS = 120;

export function ReviewCarousel({ reviews, vendorName }: Props) {
  // Defensive guard — parent already skips rendering on 0 reviews but
  // the cost of an extra check beats a blank surface if a refactor
  // skips the parent guard later.
  const [index, setIndex] = useState(0);
  if (reviews.length === 0) return null;

  const total = reviews.length;
  // Index clamp + non-null assertion are safe because we returned
  // null above on `total === 0`. TS strict-array-index needs the
  // explicit assertion since reviews[N] can be undefined to the
  // compiler.
  const current = reviews[Math.min(index, total - 1)]!;

  function prev() {
    setIndex((i) => (i - 1 + total) % total);
  }
  function next() {
    setIndex((i) => (i + 1) % total);
  }

  return (
    <section
      aria-label={`Recent reviews for ${vendorName}`}
      className="space-y-2"
    >
      {/* Mobile (<lg): single card + prev/next buttons. */}
      <div className="lg:hidden">
        <ReviewCard review={current} />
        {total > 1 ? (
          <nav
            className="mt-2 flex items-center justify-between gap-2"
            aria-label="Review carousel controls"
          >
            <button
              type="button"
              onClick={prev}
              className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-ink/15 bg-cream text-ink/70 hover:border-terracotta/50 hover:text-terracotta"
              aria-label="Previous review"
            >
              <ChevronLeft className="h-3.5 w-3.5" strokeWidth={1.75} />
            </button>
            <span
              aria-live="polite"
              className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink/50"
            >
              {index + 1} / {total}
            </span>
            <button
              type="button"
              onClick={next}
              className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-ink/15 bg-cream text-ink/70 hover:border-terracotta/50 hover:text-terracotta"
              aria-label="Next review"
            >
              <ChevronRight className="h-3.5 w-3.5" strokeWidth={1.75} />
            </button>
          </nav>
        ) : null}
      </div>

      {/* Desktop (lg+): up to 3 reviews visible side-by-side. */}
      <ul className="hidden gap-2 lg:grid lg:grid-cols-3">
        {reviews.slice(0, 3).map((r) => (
          <li key={r.review_id}>
            <ReviewCard review={r} />
          </li>
        ))}
      </ul>
    </section>
  );
}

function ReviewCard({ review }: { review: VendorReviewPreview }) {
  const body = review.body ?? '';
  const preview =
    body.length > BODY_PREVIEW_CHARS
      ? `${body.slice(0, BODY_PREVIEW_CHARS).trimEnd()}…`
      : body;
  const date = formatRelativeDate(review.created_at);

  return (
    <article
      className="flex h-full flex-col gap-1.5 rounded-lg border border-ink/10 bg-cream/60 p-2.5"
    >
      <div className="flex items-center justify-between gap-2">
        <span className="inline-flex items-center gap-1 font-mono text-[11px] text-ink">
          <Star
            aria-hidden
            className="h-3 w-3 fill-amber-400 text-amber-500"
            strokeWidth={1.75}
          />
          {formatStarRating(review.rating_overall)}
        </span>
        <span className="font-mono text-[9px] uppercase tracking-[0.15em] text-ink/45">
          {date}
        </span>
      </div>
      {preview ? (
        <p className="line-clamp-3 text-xs italic text-ink/70">
          &ldquo;{preview}&rdquo;
        </p>
      ) : (
        <p className="text-xs italic text-ink/45">
          {/* No-text review — rating without commentary is still
              valuable. Keep this polite per [[feedback_setnayan_no_dev_text_post_launch]]. */}
          A {formatStarRating(review.rating_overall)}-star rating from a recent
          event.
        </p>
      )}
      {review.author_display ? (
        <p className="mt-auto font-mono text-[9px] uppercase tracking-[0.15em] text-ink/45">
          — {review.author_display}
        </p>
      ) : null}
    </article>
  );
}

/**
 * Short relative date for the review timestamp. We keep this lean —
 * the carousel only needs "3d ago" / "2 mo ago" granularity. For
 * older reviews (>11 mo) we fall back to a year-only "2025" form so
 * the column doesn't read as a stale-looking "13 mo ago".
 */
function formatRelativeDate(iso: string): string {
  const then = Date.parse(iso);
  if (Number.isNaN(then)) return '';
  const now = Date.now();
  const diffSec = Math.max(1, (now - then) / 1000);
  if (diffSec < 60) return 'just now';
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
  if (diffSec < 86400 * 7) return `${Math.floor(diffSec / 86400)}d ago`;
  if (diffSec < 86400 * 30) return `${Math.floor(diffSec / (86400 * 7))}w ago`;
  if (diffSec < 86400 * 330) return `${Math.floor(diffSec / (86400 * 30))} mo ago`;
  return new Date(then).getFullYear().toString();
}
