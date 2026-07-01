import Image from 'next/image';
import { BadgeCheck, MapPin, Sparkles, Star } from 'lucide-react';

import { formatPhp, VENDOR_PLACEHOLDER_PHOTO } from '@/lib/vendors';
import { formatStarRating } from '@/lib/reviews';

/**
 * ExploreCardPreview — the vendor's ACTUAL Explore service card, shown on the
 * "My Services" page so a vendor sees exactly how couples find them.
 *
 * It follows the shipped card contract (app/explore/_components/vendor-card.tsx)
 * — cover photo · trust badges · "<Service> by <name>" · ★ rating (n) ·
 * "from ₱price" · distance/coverage line · recommended-by-N-couples · a review
 * quote · [View Vendor] [Add to Plan] — but rendered in the editorial --m-*
 * palette to match the reskinned dashboard (the live Explore card uses the
 * terracotta marketplace palette). Everything here is LIVE data resolved by the
 * page; nothing is illustrative.
 *
 * Name-masking follows tier: the page resolves `displayName` via
 * resolveVendorDisplayName + isTrueNameTier, so a Free/Verified store that
 * hasn't replied yet shows the anonymized "<Category> · <City>" label and its
 * real name is suppressed — exactly as couples see it.
 *
 * The [View Vendor] / [Add to Plan] buttons are INERT here (a preview, not a
 * live marketplace surface) — they carry the same labels couples tap.
 */
export type ExploreCardPreviewProps = {
  /** Resolved public cover photo (service hero → logo → placeholder). */
  coverUrl: string | null;
  /** Tier-resolved display label — real business name OR anonymized placeholder. */
  displayName: string;
  /** Whether the real business name is revealed (drives the "by <name>" line). */
  nameRevealed: boolean;
  /** Real business name — only surfaced in the "by" line when revealed. */
  businessName: string;
  /** Primary service label, e.g. "Photographer". Null → no service line. */
  serviceLabel: string | null;
  /** Trust badges the vendor genuinely holds right now. */
  badges: ReadonlyArray<'verified' | 'new'>;
  /** Average overall rating (0 = no reviews yet → "new"). */
  rating: number;
  /** Review count backing the rating. */
  reviewCount: number;
  /** Lowest active starting price in PHP; null → "quote on request". */
  startingPricePhp: number | null;
  /** The vendor's HQ city — anchors the coverage/location line. */
  locationCity: string | null;
  /** Tier coverage radius in km (Infinity for nationwide, 0 for none). */
  coverageRadiusKm: number;
  /** Distinct couples who have recommended this vendor. */
  recommendedByCount: number;
  /** One representative review quote to echo the marketplace carousel; null → none. */
  reviewQuote: string | null;
};

export function ExploreCardPreview({
  coverUrl,
  displayName,
  nameRevealed,
  businessName,
  serviceLabel,
  badges,
  rating,
  reviewCount,
  startingPricePhp,
  locationCity,
  coverageRadiusKm,
  recommendedByCount,
  reviewQuote,
}: ExploreCardPreviewProps) {
  const src = coverUrl && isOptimizableImageUrl(coverUrl) ? coverUrl : VENDOR_PLACEHOLDER_PHOTO;

  // Coverage line — the vendor's own preview can't compute distance from a
  // couple's reception venue (no couple context), so we show the honest
  // coverage the tier grants ("serves within N km of <City>"), which is what
  // the marketplace uses to place them in a couple's radius.
  const coverageLine =
    coverageRadiusKm > 0 && Number.isFinite(coverageRadiusKm)
      ? locationCity
        ? `Serves within ${coverageRadiusKm} km of ${locationCity}`
        : `Serves within ${coverageRadiusKm} km`
      : locationCity
        ? `Based in ${locationCity}`
        : null;

  return (
    <article
      className="flex h-full max-w-sm flex-col gap-3 rounded-2xl border p-4"
      style={{ background: 'var(--m-paper)', borderColor: 'var(--m-line)' }}
    >
      {/* Cover photo — always a real image (service hero → logo → placeholder). */}
      <div
        className="relative h-40 w-full shrink-0 overflow-hidden rounded-xl"
        style={{ background: 'var(--m-ivory)' }}
      >
        <Image
          src={src}
          alt={displayName}
          fill
          sizes="(max-width: 640px) 100vw, 384px"
          className="object-cover"
        />
        {badges.length > 0 ? (
          <div className="absolute left-2 top-2 flex flex-wrap gap-1.5">
            {badges.map((b) => (
              <PreviewBadge key={b} kind={b} />
            ))}
          </div>
        ) : null}
      </div>

      {/* Name + service-by line. */}
      <div className="min-w-0">
        <h3 className="truncate text-base font-semibold" style={{ color: 'var(--m-ink)' }}>
          {displayName}
        </h3>
        {serviceLabel ? (
          <p className="mt-0.5 truncate text-sm" style={{ color: 'var(--m-slate)' }}>
            <span className="font-medium" style={{ color: 'var(--m-ink)' }}>
              {serviceLabel}
            </span>
            {/* "by <name>" only when the real name is revealed — otherwise the
                displayName already encodes the anonymized "<Category> · <City>"
                and echoing "by" would leak the tell. */}
            {nameRevealed && businessName ? (
              <span style={{ color: 'var(--m-slate-2)' }}> by {businessName} </span>
            ) : null}
            {nameRevealed && businessName ? (
              <BadgeCheck
                aria-hidden
                className="ml-0.5 inline h-3.5 w-3.5 align-text-bottom"
                strokeWidth={2}
                style={{ color: 'var(--m-sage-deep)' }}
              />
            ) : null}
          </p>
        ) : null}
      </div>

      {/* Rating + price row. */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
        <span className="inline-flex items-center gap-1">
          <Star
            aria-hidden
            className="h-4 w-4"
            strokeWidth={1.75}
            style={{
              color: rating > 0 ? 'var(--m-orange)' : 'var(--m-slate-4)',
              fill: rating > 0 ? 'var(--m-orange)' : 'none',
            }}
          />
          <span className="font-medium" style={{ color: 'var(--m-ink)' }}>
            {rating > 0 ? formatStarRating(rating) : 'New'}
          </span>
          {reviewCount > 0 ? (
            <span style={{ color: 'var(--m-slate-3)' }}>({reviewCount})</span>
          ) : null}
        </span>
        <span className="font-semibold" style={{ color: 'var(--m-orange-2)' }}>
          {startingPricePhp ? `from ${formatPhp(startingPricePhp)}` : 'Quote on request'}
        </span>
      </div>

      {/* Coverage + recommended-by line. */}
      {coverageLine || recommendedByCount > 0 ? (
        <ul className="flex flex-wrap gap-x-3 gap-y-1 text-xs" style={{ color: 'var(--m-slate-2)' }}>
          {coverageLine ? (
            <li className="inline-flex items-center gap-1">
              <MapPin aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />
              {coverageLine}
            </li>
          ) : null}
          {recommendedByCount > 0 ? (
            <li className="inline-flex items-center gap-1">
              <Sparkles aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />
              Recommended by {recommendedByCount}{' '}
              {recommendedByCount === 1 ? 'couple' : 'couples'}
            </li>
          ) : null}
        </ul>
      ) : null}

      {/* One review quote — echoes the marketplace review carousel. */}
      {reviewQuote ? (
        <blockquote
          className="rounded-lg border px-3 py-2 text-xs italic"
          style={{
            borderColor: 'var(--m-line)',
            background: 'var(--m-paper-2)',
            color: 'var(--m-slate)',
          }}
        >
          &ldquo;{reviewQuote}&rdquo;
        </blockquote>
      ) : null}

      {/* CTAs — inert preview mirrors of the couple-facing buttons. */}
      <div className="mt-auto flex items-center gap-2 pt-1">
        <span
          aria-hidden
          className="inline-flex h-9 flex-1 items-center justify-center rounded-lg border px-3 text-xs font-medium"
          style={{ borderColor: 'var(--m-line)', color: 'var(--m-ink)', background: 'var(--m-paper)' }}
        >
          View Vendor
        </span>
        <span
          aria-hidden
          className="inline-flex h-9 flex-1 items-center justify-center rounded-lg px-3 text-xs font-semibold"
          style={{ background: 'var(--m-ink)', color: 'var(--m-paper)' }}
        >
          Add to Plan
        </span>
      </div>
    </article>
  );
}

/** Editorial-palette trust badge chip. */
function PreviewBadge({ kind }: { kind: 'verified' | 'new' }) {
  if (kind === 'verified') {
    return (
      <span
        className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em]"
        style={{ background: 'var(--m-paper)', color: 'var(--m-sage-deep)', border: '1px solid var(--m-line)' }}
      >
        <BadgeCheck aria-hidden className="h-3 w-3" strokeWidth={2.25} />
        Verified
      </span>
    );
  }
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em]"
      style={{ background: 'var(--m-orange-4)', color: 'var(--m-orange-2)', border: '1px solid var(--m-orange-3)' }}
    >
      <Sparkles aria-hidden className="h-3 w-3" strokeWidth={2} />
      New
    </span>
  );
}

/**
 * next/image needs a whitelisted host (next.config.ts remotePatterns). Vendor
 * uploads land on R2 / Supabase Storage; anything else falls to the bundled
 * placeholder rather than a broken next/image. Mirrors the guard in the shipped
 * marketplace card so the preview resolves identically.
 */
function isOptimizableImageUrl(url: string): boolean {
  if (url.startsWith('/')) return true;
  let host: string;
  try {
    host = new URL(url).hostname;
  } catch {
    return false;
  }
  return (
    host.endsWith('.r2.dev') ||
    host.endsWith('.r2.cloudflarestorage.com') ||
    host.endsWith('.supabase.co') ||
    host.endsWith('.supabase.in') ||
    host === 'picsum.photos' ||
    host === 'fastly.picsum.photos'
  );
}
