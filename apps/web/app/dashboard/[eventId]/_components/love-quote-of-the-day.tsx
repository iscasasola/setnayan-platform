/**
 * Love-quote-of-the-day · event-home card (server component).
 *
 * Owner directive 2026-05-22 (verbatim):
 *   "we want a 365 days in love quote that will be shared everyday
 *    depending on how far they are from the wedding."
 *
 * Surface: rendered on `/dashboard/[eventId]` event home, between the
 * WelcomeHeader and the AuspiciousChip. Hosts see a different uplifting line
 * each time they visit Home depending on `daysToWedding`.
 *
 * Behavior:
 *   - `daysToWedding === null` (no date set yet) → returns null. We don't
 *     surface a quote-of-the-day until the host has narrowed to a real day.
 *     Avoids cluttering brand-new events with content that has no anchor.
 *   - `daysToWedding === some-number` → resolves to the nearest seeded
 *     quote via `quoteForDay()` (see lib/love-quotes.ts for the fallback
 *     contract — always returns a quote, never errors).
 *
 * Voice (per [[feedback_setnayan_no_dev_text_post_launch]] + the 2026-05-12
 *   "luxurious, Filipino, modern" lock):
 *   - Cormorant-italic-display blockquote
 *   - DM Mono accent eyebrow for the source attribution
 *   - cream/60 bg + terracotta/20 border subtle card chrome matching adjacent
 *     event-home cards (concierge-banner, day-of-mode/grid)
 *
 * Accessibility:
 *   - Semantic `<figure>` + `<blockquote>` + `<figcaption>` markup
 *   - Source attribution renders only when present
 *   - Smart-quote typographic open/close glyphs around the blockquote
 *
 * No DB schema. Pure content lookup via `quoteForDay()`. No client JS — the
 * server component renders the quote text directly into the page HTML.
 */

import { quoteForDay } from '@/lib/love-quotes';

type Props = {
  /** Days until wedding. `null` when the host hasn't picked a real day yet. */
  daysToWedding: number | null;
};

export function LoveQuoteOfTheDay({ daysToWedding }: Props) {
  if (daysToWedding === null) return null;

  const quote = quoteForDay(daysToWedding);
  if (!quote) return null;

  return (
    <figure className="rounded-2xl border border-terracotta/20 bg-cream/60 px-5 py-4">
      <blockquote className="font-display text-lg italic leading-relaxed text-ink/85">
        &ldquo;{quote.text}&rdquo;
      </blockquote>
      {quote.source ? (
        <figcaption className="mt-2 font-mono text-[10px] uppercase tracking-[0.2em] text-ink/55">
          — {quote.source}
        </figcaption>
      ) : null}
    </figure>
  );
}
