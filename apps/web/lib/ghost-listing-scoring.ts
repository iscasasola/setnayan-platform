// NOTE: deliberately NOT 'server-only'. This module holds the PURE, I/O-free
// ghost-listing scorer + its constants/labels/types so the Node test runner
// (`tsx --test`, `pnpm test:unit`) can import it directly (mirrors the
// perceptual-hash.ts / vendor-image-repost-watch.ts split). The server-only I/O
// that calls this — scanForGhostListings — lives in lib/ghost-listing-detector.ts.

/**
 * Ghost-listing scorer — deterministic scoring of a marketplace vendor_profiles
 * row for "ghost" signals (placeholder / abandoned / duplicate identity). See
 * lib/ghost-listing-detector.ts for the full feature docs; this is only the math.
 *
 * Signals (0..100, higher = more ghost-like), summed then clamped:
 *   · NO LOGO            — blank logo_url.
 *   · NO ACTIVE SERVICES — zero active vendor_services.
 *   · NEVER ANSWERED     — inbound couple messages but zero vendor replies.
 *   · LONG DORMANT       — updated_at older than DORMANT_DAYS (ramps with age).
 *   · DUPLICATE IDENTITY — shares a normalized name/email with another vendor.
 */

// ── Owner-tunable thresholds (first-pass defaults) ──────────────────────────

const NO_LOGO_POINTS = 20;
const NO_SERVICES_POINTS = 25;
const NEVER_ANSWERED_POINTS = 25;

/** Days of inactivity before the dormancy signal starts contributing. */
const DORMANT_DAYS = 120;
/** Days of inactivity at which dormancy maxes. */
const DORMANT_MAX_DAYS = 365;
const DORMANT_MAX_POINTS = 20;

// Set to the flag threshold: a listing sharing a business name or contact email
// with ANOTHER live listing (a clone / squatted identity) is actionable on its
// own, so duplicate identity crosses the bar without needing a second signal.
const DUPLICATE_IDENTITY_POINTS = 45;

/** Total score at/above which a listing is flagged into the queue. */
export const GHOST_LISTING_FLAG_THRESHOLD = 45;

// ── Types ───────────────────────────────────────────────────────────────────

/** Non-PII evidence persisted alongside a flag (RA 10173-safe). */
export type GhostListingDetail = {
  score: number;
  has_logo: boolean;
  active_service_count: number;
  unanswered: boolean;
  inbound_message_count: number;
  dormant_days: number;
  duplicate_of_count: number;
  points: {
    no_logo: number;
    no_services: number;
    never_answered: number;
    dormancy: number;
    duplicate_identity: number;
  };
};

export type GhostListingScore = {
  score: number;
  reason: string;
  detail: GhostListingDetail;
};

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));

/** Normalize a business identity string for duplicate matching. */
export function normalizeIdentity(raw: string | null | undefined): string {
  return (raw ?? '').trim().toLowerCase().replace(/\s+/g, ' ');
}

/**
 * Combine the ghost-listing signal inputs into a 0..100 score + a primary reason
 * label. Pure + deterministic — every I/O-derived number is passed in.
 */
export function scoreGhostListing(inputs: {
  hasLogo: boolean;
  activeServiceCount: number;
  inboundMessageCount: number;
  vendorReplyCount: number;
  dormantDays: number;
  duplicateOfCount: number;
}): GhostListingScore {
  const {
    hasLogo,
    activeServiceCount,
    inboundMessageCount,
    vendorReplyCount,
    dormantDays,
    duplicateOfCount,
  } = inputs;

  const noLogoPts = hasLogo ? 0 : NO_LOGO_POINTS;
  const noServicesPts = activeServiceCount > 0 ? 0 : NO_SERVICES_POINTS;

  // Never-answered only counts when couples actually reached out AND the vendor
  // never replied — an unmanned storefront, not merely an inbox-zero new vendor.
  const unanswered = inboundMessageCount > 0 && vendorReplyCount === 0;
  const neverAnsweredPts = unanswered ? NEVER_ANSWERED_POINTS : 0;

  // Dormancy ramps from DORMANT_DAYS to DORMANT_MAX_DAYS.
  const dormancyPts =
    dormantDays <= DORMANT_DAYS
      ? 0
      : Math.round(
          clamp(
            (dormantDays - DORMANT_DAYS) / (DORMANT_MAX_DAYS - DORMANT_DAYS),
            0,
            1,
          ) * DORMANT_MAX_POINTS,
        );

  const duplicatePts = duplicateOfCount > 0 ? DUPLICATE_IDENTITY_POINTS : 0;

  const score = clamp(
    noLogoPts + noServicesPts + neverAnsweredPts + dormancyPts + duplicatePts,
    0,
    100,
  );

  // Primary reason = biggest contributor (duplicate identity wins ties — it's
  // the most actionable, and points at a concrete other listing).
  let reason = 'low_signal';
  const contributors: [string, number][] = [
    ['duplicate_identity', duplicatePts],
    ['never_answered', neverAnsweredPts],
    ['no_active_services', noServicesPts],
    ['no_logo', noLogoPts],
    ['abandoned_listing', dormancyPts],
  ];
  contributors.sort((a, b) => b[1] - a[1]);
  const top = contributors[0];
  if (top && top[1] > 0) reason = top[0];

  const detail: GhostListingDetail = {
    score,
    has_logo: hasLogo,
    active_service_count: activeServiceCount,
    unanswered,
    inbound_message_count: inboundMessageCount,
    dormant_days: dormantDays,
    duplicate_of_count: duplicateOfCount,
    points: {
      no_logo: noLogoPts,
      no_services: noServicesPts,
      never_answered: neverAnsweredPts,
      dormancy: dormancyPts,
      duplicate_identity: duplicatePts,
    },
  };

  return { score, reason, detail };
}

export const GHOST_LISTING_REASON_LABEL: Record<string, string> = {
  duplicate_identity:
    'Shares a business name or contact email with another listing (possible clone / squatted identity).',
  never_answered: 'Couples have messaged this vendor but they have never replied.',
  no_active_services: 'No active bookable services.',
  no_logo: 'No business logo uploaded.',
  abandoned_listing: 'Long dormant — not updated in a long time.',
  low_signal: 'Low combined ghost-listing signal.',
};
