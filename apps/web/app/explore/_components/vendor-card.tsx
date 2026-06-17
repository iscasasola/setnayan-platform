/**
 * VendorCard — marketplace quick-view card per the 2026-05-22 owner
 * directive (CLAUDE.md decision log row "Ship vendor marketplace card
 * quick-view redesign + 4-badge system").
 *
 * Replaces the inline `VendorMarketCard` previously hosted in
 * `apps/web/app/explore/page.tsx`. Extracting it into its own component
 * (a) keeps page.tsx scrollable (was 2,580 lines), (b) gives the badge
 * system + review carousel + service-photo lookup their own surface
 * for future iteration without bloating the page module, (c) matches
 * the orphan-prevention rule from CLAUDE.md (every shipped UI surface
 * is reachable + has a parent entry point — this card is reached via
 * `/explore` page render, which itself is reachable from top-nav
 * Browse + dashboard planning-group Search buttons + sitemap).
 *
 * Quick-view contract (verbatim from owner):
 *
 *   "Photo, Badges, Service name by (Contact person of Vendor Name),
 *    Starting Price/ Price Range, Distance from Reception Venue,
 *    Review Rating, Carousel of reviews, [View Vendor] [Add to /Remove
 *    from Plan]"
 *
 * Layout — mobile-first:
 *   <sm: Photo full-width on top → badges → name + service line →
 *         price line → distance → rating → carousel (1 card) →
 *         CTAs stacked full-width
 *   sm+:  Photo on left as square thumbnail (88px) → header right →
 *         body below → carousel (3 cards visible on lg+) → CTAs inline
 *
 * Existing card concerns we preserve (unchanged from the old
 * VendorMarketCard):
 *   - Coming-soon visibility state hides the Follow CTA + dims border.
 *   - Sponsored / Boosted ad accents win the border treatment.
 *   - Demo-mode chip + starting-price label for admin demo browsing
 *     (2026-05-22 evening lock).
 *   - Save-vendor button gated on authenticated + has-event + bookable.
 *   - View profile link to /v/[slug].
 *
 * Brand-voice rules per [[feedback_setnayan_no_dev_text_post_launch]]:
 *   - No "TODO", no "skeleton", no "placeholder" text user-visible.
 *   - Empty review carousel returns null silently (no awkward
 *     "0 reviews" empty state).
 *   - 0-distance / missing-distance hides the row instead of showing
 *     "—".
 *
 * Why "Service name by (Contact)" instead of just business name:
 *   The owner's directive specifically named this format. The vendor's
 *   primary service (vendor.services[0]) is the readable label of WHAT
 *   they do; business_name is WHO does it. We compose as
 *   `<service> by <business_name>` to give couples scanning the grid
 *   an instant "is this what I'm shopping for" read without parsing
 *   the business name. A `contact_person_name` column doesn't exist
 *   on vendor_profiles in V1; if/when iteration 0006 adds it, swap
 *   `vendor.business_name` → `${vendor.contact_person_name} (${vendor.business_name})`.
 */

import Image from 'next/image';
import Link from 'next/link';
import { MapPin, Navigation, Sparkles, Star, ExternalLink, Zap, Clock, AlertCircle } from 'lucide-react';

import { displayServiceLabel, formatPhp, resolveVendorDisplayName, VENDOR_PLACEHOLDER_PHOTO } from '@/lib/vendors';
import { isTrueNameTier } from '@/lib/vendor-tier-caps';
import { formatStarRating } from '@/lib/reviews';
import { haversineKm, formatDistanceKm } from '@/lib/distance';
import { parseVisibility, isBookable } from '@/lib/vendor-visibility';
import type { VendorPublicVisibility } from '@/lib/vendor-visibility';
import type { ActiveAdLookup } from '@/lib/vendor-ads';
import type { VendorBadge } from '@/lib/vendor-badges';
import type { VendorReviewPreview } from '@/lib/vendor-reviews-preview';
import { FollowGate } from '@/app/_components/follow-gate';
import { SaveVendorButton } from './save-vendor-button';
import { ReviewCarousel } from './review-carousel';
import { VendorBadgeRow } from './vendor-badge-row';

/**
 * Row shape consumed by the card. Mirrors `VendorCardRow` in page.tsx
 * with two additions: `starting_price_php` (resolved from one of the
 * vendor's services) and `primary_photo_url` (resolved from the same
 * service's `primary_photo_r2_key` → r2PublicUrl). Both are added by
 * the page-level enrichment pass, kept optional so the card never
 * crashes if the underlying lookup returns null.
 */
export type VendorCardData = {
  vendor_profile_id: string;
  public_id: string;
  business_name: string;
  business_slug: string | null;
  tagline: string | null;
  logo_url: string | null;
  services: string[];
  location_city: string | null;
  hq_latitude: number | null;
  hq_longitude: number | null;
  contact_email: string | null;
  public_visibility: VendorPublicVisibility;
  created_at: string;
  avg_rating_overall: number;
  review_count: number;
  is_demo?: boolean | null;
  demo_starts_at_label?: string | null;
  /** Resolved at page level from vendor_services.starting_price_php
   *  (lowest active service for this vendor). Null when no service
   *  has a price set yet — card hides the price row instead of
   *  showing "—". */
  starting_price_php?: number | null;
  /** Resolved public URL for the vendor's hero service photo. Null
   *  falls through to vendor logo, then initials. */
  primary_photo_url?: string | null;
  /** V2.1 brief amendment #2 (locked 2026-05-30 · CLAUDE.md row
   *  "🔒 V2.1 BRIEF AMENDMENT #2 LOCKED" § 1(d) + memory rule
   *  [[project_setnayan_vendor_hybrid_anonymity]]). NULL = the
   *  vendor's `business_name` is hidden in marketplace cards and
   *  surfaces render the anonymized taxonomy + city placeholder via
   *  `resolveVendorDisplayName` from lib/vendors.ts. Non-NULL = name
   *  globally revealed (DB trigger `reveal_vendor_name_on_chat`
   *  stamps this on first vendor chat reply · PR #662 / migration
   *  20260530010000). Pro + Enterprise vendors are also revealed via
   *  the app-layer `isPaidTier` derivation but no subscription join
   *  exists at the marketplace surface today; the placeholder still
   *  only renders while name_revealed_at IS NULL so once any Pro+
   *  vendor sends a reply the real name surfaces unchanged. */
  name_revealed_at?: string | null;
  /** CLAUDE.md 2026-05-30 refinement row · stored Bark-format
   *  anonymized name like "Manila Wedding Photographer #4218" from
   *  `vendor_profiles.screen_name` (migration `20260714000000`). When
   *  present, `resolveVendorDisplayName` surfaces this stable
   *  identifier instead of computing the legacy taxonomy-and-city
   *  placeholder ("Photography · Quezon City") on every render.
   *  Hydrated by page.tsx via the same vendor_profiles batched read
   *  that pulls verification_state + name_revealed_at. Null = pre-
   *  backfill vendor OR venue-exempt vendor where the generator
   *  deliberately skipped (services overlap with religious_venue +
   *  venue); resolver falls back to the legacy computed placeholder
   *  in that case so existing behavior preserves. */
  screen_name?: string | null;
  /** Phase C tier gate (vendor-tier-caps). `tier_state` enum on
   *  vendor_profiles (free | verified | pro | enterprise) · NOT in the
   *  market_stats view, so hydrated by page.tsx from the same
   *  vendor_profiles enrichment batch as screen_name / name_revealed_at.
   *  Drives the day-1 name reveal (isTrueNameTier → pro/enterprise show
   *  real business_name) + the review-display gate (stars / comments).
   *  Optional + `?? null` → free → hidden when absent. */
  tier_state?: string | null;
  /**
   * Relationship depth between this couple's active event and the vendor (0–3).
   * Computed from event_vendors + vendor_event_unlocks when the viewer is
   * authenticated and has an active event. 0 (or absent) = no relationship.
   *   3 → "Your vendor"           (deposit paid or complete)
   *   2 → "You're in conversation" (vendor_event_unlocks row exists)
   *   1 → "In your shortlist"     (any non-declined event_vendors row)
   *   0 → no badge
   */
  relationship_depth?: 0 | 1 | 2 | 3;
  /**
   * PR #6 — quality / activity signals from vendor_activity_stats.
   * quality_score        0–100 composite (70% couple_trust + 30% health).
   *                      NULL when no row exists yet (vendor not yet scored).
   * finalized_booking_count  drives the experience-tier badge.
   * last_active_at       ISO timestamp of last login — drives the
   *                      "Low recent activity" badge (> 60 days).
   * avg_response_minutes drives the "Usually responds in Xh" badge (< 4h).
   */
  quality_score?: number | null;
  finalized_booking_count?: number | null;
  last_active_at?: string | null;
  avg_response_minutes?: number | null;
  /**
   * PR #6 — partnership badge from vendor_partnerships (admin-verified only).
   * Null = no relevant partnership for this couple's shortlisted vendors.
   * Set only when the couple is logged in + has a shortlisted vendor who
   * has an active admin-verified partnership pointing at this card vendor.
   */
  partnership_badge?: {
    relationship_type: 'sponsored_included' | 'sponsored_discounted' | 'accredited' | 'general';
    recommending_vendor_name: string;
    discount_pct: number | null;
  } | null;
};

type Props = {
  vendor: VendorCardData;
  rating: number;
  reviewCount: number;
  isAuthenticated: boolean;
  isFollowing: boolean;
  isSaved: boolean;
  eventId: string | null;
  venueAnchor: { lat: number; lng: number } | null;
  ad: ActiveAdLookup | null;
  badges: ReadonlyArray<VendorBadge>;
  reviews: ReadonlyArray<VendorReviewPreview>;
};

export function VendorCard({
  vendor,
  rating,
  reviewCount,
  isAuthenticated,
  isFollowing,
  isSaved,
  eventId,
  venueAnchor,
  ad,
  badges,
  reviews,
}: Props) {
  const primaryService = vendor.services[0] ?? null;
  const serviceLabel = primaryService ? displayServiceLabel(primaryService) : null;
  // V2.1 brief amendment #2 (2026-05-30) · hybrid-anonymity label.
  // Free + Verified vendors render the placeholder until their first
  // chat reply stamps name_revealed_at; once revealed (or for paid
  // tiers via the app-layer flag · or for venue-exempt vendors per
  // services overlap with religious_venue / venue) the real
  // business_name surfaces. Single resolver call so the card header,
  // the "by ..." composition, and the VendorHero initial-letter
  // fallback all stay in lock-step.
  // Refinement landed CLAUDE.md 2026-05-30 row: pass `services` so the
  // venue exception applies (Ceremony + Reception Venues always real-
  // name) + pass `screen_name` so the Bark-format stable identifier
  // surfaces when present instead of the computed "service · city"
  // legacy placeholder. Phase C #4 (2026-06-09): isPaidTier now derives
  // from the vendor's real tier_state via isTrueNameTier — Pro/Enterprise
  // reveal their business_name day-1 (the marketplace enrichment batch
  // selects tier_state). Venue exception fires first if applicable, then
  // name_revealed_at gates the rest for Free/Verified.
  const displayLabel = resolveVendorDisplayName({
    business_name: vendor.business_name,
    name_revealed_at: vendor.name_revealed_at ?? null,
    primary_canonical_service: primaryService,
    location_city: vendor.location_city,
    services: vendor.services,
    screen_name: vendor.screen_name ?? null,
    // Phase C: Pro/Enterprise reveal real business_name day-1.
    isPaidTier: isTrueNameTier(vendor.tier_state ?? null),
  });
  const slug = vendor.business_slug ?? null;
  const href = slug ? `/v/${slug}` : `#`;
  const visibility = parseVisibility(vendor.public_visibility);
  const bookable = isBookable(visibility);
  const isComingSoon = visibility === 'coming_soon';
  const sponsoredAccent = ad?.tier === 'sponsored';
  const boostedAccent = ad?.tier === 'boosted';
  const isDemoCard = vendor.is_demo === true;

  // Distance — both ends must exist or we skip the row entirely (no
  // "— km from venue" placeholder per the no-dev-text rule).
  const distanceKm = (() => {
    if (
      !venueAnchor ||
      vendor.hq_latitude === null ||
      vendor.hq_longitude === null
    ) {
      return null;
    }
    const lat = Number(vendor.hq_latitude);
    const lng = Number(vendor.hq_longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    return haversineKm(venueAnchor.lat, venueAnchor.lng, lat, lng);
  })();

  // Price line — only render when a real number is available. The
  // 2026-05-16 hide-prices lock keeps real-vendor cards price-less in
  // V1; this surface still respects that by gating on the page-level
  // enrichment (which itself respects the hide-prices contract).
  const priceLine = vendor.starting_price_php
    ? `Starts at ${formatPhp(vendor.starting_price_php)}`
    : isDemoCard && vendor.demo_starts_at_label
      ? vendor.demo_starts_at_label
      : null;

  return (
    <article
      className={`flex h-full flex-col gap-3 rounded-2xl border bg-cream p-4 transition-shadow hover:shadow-md ${
        isDemoCard
          ? 'border-amber-300 ring-1 ring-amber-200/70'
          : isComingSoon
            ? 'border-dashed border-ink/20 opacity-90'
            : sponsoredAccent
              ? 'border-amber-300 ring-1 ring-amber-200'
              : boostedAccent
                ? 'border-terracotta/30'
                : 'border-ink/10'
      }`}
    >
      {/* Photo full-row banner on top on ALL viewports (owner directive
          2026-05-22 PM: "full row photo on top fill"). Earlier layout
          shrunk the photo to a 80×80 square on sm+ which read as a small
          avatar tile — now consistent full-width banner everywhere with
          name + badges + price stacked below. */}
      <VendorHero
        photoUrl={vendor.primary_photo_url ?? null}
        logoUrl={vendor.logo_url}
        /* Hybrid-anonymity (V2.1 amendment #2 · 2026-05-30): pass the
           resolved display label so the photo placeholder initials
           and the alt text both surface the taxonomy-derived label
           when the business_name is hidden. The fallback to
           "Vendor"/"V" still kicks in for the unrealistic case where
           both displayLabel and business_name end up empty. */
        name={displayLabel}
      />
      <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="min-w-0 truncate text-base font-semibold text-ink">
              {/* Hybrid-anonymity (V2.1 amendment #2): render the resolved
                  display label · real business_name once revealed, or
                  the taxonomy + city placeholder while hidden. */}
              {displayLabel}
            </h2>
            {isDemoCard ? (
              <span
                className="shrink-0 inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.15em] text-amber-800"
                title="Synthetic vendor — visible only to admins in demo mode."
              >
                <Sparkles className="h-3 w-3" strokeWidth={2} aria-hidden />
                Demo
              </span>
            ) : null}
            {isComingSoon ? (
              <span className="shrink-0 rounded-full bg-ink/8 px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.15em] text-ink/55">
                Coming soon
              </span>
            ) : null}
            {sponsoredAccent ? (
              <span className="shrink-0 rounded-full bg-amber-400 px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.15em] text-amber-950">
                Featured Sponsor
              </span>
            ) : boostedAccent ? (
              <span className="shrink-0 rounded-full bg-terracotta px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.15em] text-cream">
                Boosted
              </span>
            ) : null}
          </div>
          {/* Service-name-by-business-name composition per the owner
              directive. When no canonical service is on the vendor's
              services[] array we fall back to the business name alone
              (the bare row would otherwise read empty). */}
          {/* Hybrid-anonymity (V2.1 amendment #2 · 2026-05-30): when the
              vendor's business_name is hidden, the displayLabel
              already encodes "<Service Label> · <City>" (or just
              "<Service Label>" when no city) — surfacing the "by …"
              composition on top would be redundant + would leak the
              "by" copy as a tell. Suppress the secondary line entirely
              while hidden; reveal it once the name is back so the
              originally-locked "<Service> by <Business>" framing
              returns intact. */}
          {serviceLabel && displayLabel === vendor.business_name ? (
            <p className="mt-0.5 text-sm text-ink/65">
              <span className="font-medium text-ink">{serviceLabel}</span>{' '}
              <span className="text-ink/55">by {vendor.business_name}</span>
            </p>
          ) : null}
          {/* Badge row — placed below the name so it's visible at
              first glance even when the card is dense. Hidden when
              the vendor has no badges (renders as empty <ul>). */}
          {badges.length > 0 ? (
            <div className="mt-2">
              <VendorBadgeRow badges={badges} />
            </div>
          ) : null}
      </div>

      {/* Relationship-depth badge — only when logged in + has active event
          (page.tsx only sets relationship_depth when both conditions are true).
          Depth-1 vendors also get an "Add to inquiry" CTA that opens their
          workspace thread for this event. */}
      {(vendor.relationship_depth ?? 0) >= 1 ? (
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={`inline-flex items-center rounded-full px-2.5 py-0.5 font-mono text-[9px] uppercase tracking-[0.15em] ${
              vendor.relationship_depth === 3
                ? 'bg-ink text-cream'
                : vendor.relationship_depth === 2
                  ? 'bg-mulberry/10 text-mulberry ring-1 ring-mulberry/25'
                  : 'bg-terracotta/15 text-terracotta ring-1 ring-terracotta/30'
            }`}
          >
            {vendor.relationship_depth === 3
              ? 'Your vendor'
              : vendor.relationship_depth === 2
                ? "You're in conversation"
                : 'In your shortlist'}
          </span>
        </div>
      ) : null}

      {/* PR #6 — partnership badge. Renders only when an admin-verified
          active partnership exists between one of the couple's shortlisted
          vendors and this vendor. Pinned types (sponsored_included,
          sponsored_discounted) render a prominent teal chip; accredited
          gets an indigo chip; general gets a subtle grey label. */}
      {vendor.partnership_badge ? (
        <PartnershipBadge badge={vendor.partnership_badge} />
      ) : null}

      {/* PR #6 — activity / quality signals row. Renders at most two chips
          (responsiveness + experience tier OR low-activity warning). Never
          renders placeholder text when data is absent. */}
      <ActivityBadges
        avgResponseMinutes={vendor.avg_response_minutes ?? null}
        lastActiveAt={vendor.last_active_at ?? null}
        finalizedBookingCount={vendor.finalized_booking_count ?? null}
      />

      {vendor.tagline ? (
        <p className="line-clamp-2 text-sm text-ink/65">{vendor.tagline}</p>
      ) : null}

      {/* Price line — independent surface, doesn't share the badge
          row so it can sit above the meta-row consistently. Real
          vendors stay price-less in V1 (hide-prices lock); demo
          vendors and any vendor that opts into surfacing
          `starting_price_php` light up. */}
      {priceLine ? (
        <p className={`font-mono text-xs ${
          isDemoCard ? 'text-amber-800/90' : 'text-ink/70'
        }`}>
          {priceLine}
        </p>
      ) : null}

      <ul className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-ink/55">
        {vendor.location_city ? (
          <li className="inline-flex items-center gap-1">
            <MapPin className="h-3.5 w-3.5" strokeWidth={1.75} />
            {vendor.location_city}
          </li>
        ) : null}
        {distanceKm !== null ? (
          <li className="inline-flex items-center gap-1 text-terracotta">
            <Navigation className="h-3.5 w-3.5" strokeWidth={1.75} />
            {formatDistanceKm(distanceKm)} from your reception venue
          </li>
        ) : null}
        <li className="inline-flex items-center gap-1">
          <Star
            className={`h-3.5 w-3.5 ${
              rating > 0 ? 'fill-amber-400 text-amber-500' : 'text-ink/25'
            }`}
            strokeWidth={1.75}
          />
          <span className="font-mono">
            {rating > 0 ? formatStarRating(rating) : 'new'}
          </span>
          {reviewCount > 0 ? (
            <span className="text-ink/45">
              ({reviewCount} {reviewCount === 1 ? 'review' : 'reviews'})
            </span>
          ) : null}
        </li>
      </ul>

      {/* Review carousel — server component renders the wrapper, the
          client carousel inside handles index state. Gate on
          reviews.length > 0 so we don't surface an awkward empty
          carousel. */}
      {reviews.length > 0 ? (
        /* Hybrid-anonymity (V2.1 amendment #2): pass displayLabel so
           the carousel's surrounding copy (e.g., "Reviews of {name}")
           doesn't leak the hidden business_name through a side surface. */
        <ReviewCarousel reviews={reviews} vendorName={displayLabel} />
      ) : null}

      <div className="mt-auto space-y-2 pt-2">
        {bookable ? (
          <FollowGate
            vendorProfileId={vendor.vendor_profile_id}
            /* Hybrid-anonymity (V2.1 amendment #2 · 2026-05-30): the
               FollowGate copy ("Follow {name}") inherits the resolved
               display label so a hidden vendor surfaces as e.g.,
               "Follow Manila Wedding Photographer" instead of leaking
               the real business_name through the follow CTA. */
            vendorName={displayLabel}
            vendorEmail={vendor.contact_email}
            isAuthenticated={isAuthenticated}
            initialFollowing={isFollowing}
            eventId={eventId}
            revalidatePath="/explore"
            variant="card"
          />
        ) : (
          <p className="text-xs text-ink/55">
            Setnayan is verifying their setup.
          </p>
        )}
        <div className="flex flex-wrap items-center gap-2 sm:flex-nowrap">
          {/* Save-to-picks (2026-05-20). Acts as the "Add to plan"
              CTA the owner directive specifies. The button's
              terminal "Saved" state IS the "Remove from plan"
              affordance in the prior implementation; future iteration
              can split into add+remove toggle if we measure couples
              actually want to undo from the marketplace surface. */}
          {bookable && isAuthenticated && eventId ? (
            <SaveVendorButton
              vendorProfileId={vendor.vendor_profile_id}
              initiallySaved={isSaved}
              canSave={true}
            />
          ) : null}
          {slug ? (
            <Link
              href={href}
              className="inline-flex items-center gap-1 text-xs font-medium text-terracotta hover:underline"
            >
              View vendor
              <ExternalLink className="h-3 w-3" strokeWidth={1.75} aria-hidden />
            </Link>
          ) : null}
        </div>
      </div>
    </article>
  );
}

/**
 * PR #6 — Partnership badge chip. Relationship-type specific copy and
 * colour. Only rendered when page.tsx resolves an admin-verified partnership
 * between this vendor and one of the couple's shortlisted vendors.
 */
function PartnershipBadge({
  badge,
}: {
  badge: NonNullable<VendorCardData['partnership_badge']>;
}) {
  const { relationship_type: type, recommending_vendor_name: source, discount_pct: disc } = badge;

  let chipCopy: string;
  let chipClasses: string;

  if (type === 'sponsored_included') {
    chipCopy = `Included with ${source} · No extra fee`;
    chipClasses = 'border-teal-300/60 bg-teal-50 text-teal-900';
  } else if (type === 'sponsored_discounted') {
    chipCopy = `Preferred partner of ${source}${disc ? ` · ${disc}% off` : ''}`;
    chipClasses = 'border-teal-300/60 bg-teal-50 text-teal-900';
  } else if (type === 'accredited') {
    chipCopy = `Accredited by ${source}`;
    chipClasses = 'border-indigo-300/60 bg-indigo-50 text-indigo-900';
  } else {
    // general
    chipCopy = `Recommended by ${source}`;
    chipClasses = 'border-ink/15 bg-ink/5 text-ink/70';
  }

  return (
    <div
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 font-mono text-[9px] uppercase tracking-[0.12em] ${chipClasses}`}
      title={`This vendor has a verified partnership with ${source}.`}
    >
      <Zap className="h-3 w-3 shrink-0" strokeWidth={2} aria-hidden />
      <span className="truncate">{chipCopy}</span>
    </div>
  );
}

/** 60 days in milliseconds — threshold for the "low recent activity" warning. */
const LOW_ACTIVITY_THRESHOLD_MS = 60 * 24 * 60 * 60 * 1000;
/** 4 hours in minutes — threshold for "usually responds in Xh" badge. */
const FAST_REPLY_THRESHOLD_MIN = 240;

/**
 * PR #6 — Activity / quality signal chips. Shows at most two badges:
 *   1. Responsiveness — "Usually responds in Xh" when median < 4h + last login ≤ 7d.
 *   2. Experience tier — from finalized_booking_count:
 *        0       → New to Setnayan (suppressed — "new" already covered by VendorBadgeRow)
 *        1–10    → Established
 *        11–50   → Experienced
 *        51–200  → Expert
 *        200+    → Elite
 *   3. Low activity warning — only shown when no responsiveness badge AND
 *      last_active_at > 60 days ago.
 *
 * All inputs optional; renders nothing when all are null.
 */
function ActivityBadges({
  avgResponseMinutes,
  lastActiveAt,
  finalizedBookingCount,
}: {
  avgResponseMinutes: number | null;
  lastActiveAt: string | null;
  finalizedBookingCount: number | null;
}) {
  const now = Date.now();

  // Responsiveness badge — fast reply rate + recently online.
  const isRecentlyActive =
    lastActiveAt !== null &&
    now - Date.parse(lastActiveAt) <= 7 * 24 * 60 * 60 * 1000;
  const showResponsive =
    avgResponseMinutes !== null &&
    avgResponseMinutes < FAST_REPLY_THRESHOLD_MIN &&
    isRecentlyActive;

  // Low-activity warning — skip when we're already surfacing responsiveness.
  const isInactive =
    !showResponsive &&
    lastActiveAt !== null &&
    now - Date.parse(lastActiveAt) > LOW_ACTIVITY_THRESHOLD_MS;

  // Experience tier from finalized bookings.
  let experienceTier: string | null = null;
  if (finalizedBookingCount !== null && finalizedBookingCount > 0) {
    if (finalizedBookingCount >= 200) experienceTier = 'Elite';
    else if (finalizedBookingCount >= 51) experienceTier = 'Expert';
    else if (finalizedBookingCount >= 11) experienceTier = 'Experienced';
    else experienceTier = 'Established';
  }

  if (!showResponsive && !isInactive && !experienceTier) return null;

  return (
    <ul className="flex flex-wrap gap-1.5">
      {showResponsive && avgResponseMinutes !== null ? (
        <li
          className="inline-flex items-center gap-1 rounded-full border border-emerald-300/50 bg-emerald-50 px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.12em] text-emerald-900"
          title="This vendor has a fast median response time and was active recently."
        >
          <Clock className="h-3 w-3 shrink-0" strokeWidth={2} aria-hidden />
          {avgResponseMinutes < 60
            ? `Usually responds in ${avgResponseMinutes}m`
            : `Usually responds in ${Math.round(avgResponseMinutes / 60)}h`}
        </li>
      ) : isInactive ? (
        <li
          className="inline-flex items-center gap-1 rounded-full border border-amber-300/50 bg-amber-50 px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.12em] text-amber-900"
          title="This vendor hasn't logged in recently. Messages may take longer than usual."
        >
          <AlertCircle className="h-3 w-3 shrink-0" strokeWidth={2} aria-hidden />
          Low recent activity
        </li>
      ) : null}
      {experienceTier ? (
        <li
          className="inline-flex items-center gap-1 rounded-full border border-violet-300/50 bg-violet-50 px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.12em] text-violet-900"
          title={`${finalizedBookingCount} finalized events through Setnayan.`}
        >
          {experienceTier}
        </li>
      ) : null}
    </ul>
  );
}

/**
 * Photo-with-logo-fallback hero. Resolution order:
 *   1. vendor.primary_photo_url   ← resolved from vendor_services.primary_photo_r2_key
 *   2. vendor.logo_url             ← business logo
 *   3. initials placeholder        ← cream tile w/ 2-letter initials
 *
 * Mirrors the 4-tier ladder in finalized-chip-strip.tsx but skips
 * tier 1 (manual_vendor_photo_url) — manual vendors don't appear in
 * the public marketplace surface, so the manual-vendor tier
 * collapses to the marketplace photo here.
 */
function VendorHero({
  photoUrl,
  logoUrl,
  name,
}: {
  photoUrl: string | null;
  logoUrl: string | null;
  name: string;
}) {
  // Always render a photo: the vendor's primary photo, else their logo, else
  // the bundled generic placeholder (owner: "vendors with no photo for their
  // service must have at least a generic placeholder photo"). No bare-initials
  // tile — a missing photo now reads as a real image, never an empty monogram.
  const src =
    photoUrl && isOptimizableImageUrl(photoUrl)
      ? photoUrl
      : logoUrl && isOptimizableImageUrl(logoUrl)
        ? logoUrl
        : VENDOR_PLACEHOLDER_PHOTO;

  // Full-row banner on all viewports per owner directive 2026-05-22 PM.
  // Heights step from 32 (mobile) → 40 (tablet+) → 48 (lg+) so the photo
  // scales with the card width when the marketplace grid widens.
  return (
    <div className="relative h-32 w-full shrink-0 overflow-hidden rounded-xl bg-ink/5 sm:h-40 lg:h-48">
      <Image
        src={src}
        alt={name}
        fill
        sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
        className="object-cover"
      />
    </div>
  );
}

/**
 * next/image needs an absolute URL whose host is in
 * `next.config.ts`'s `images.remotePatterns` whitelist. Vendor uploads
 * land on R2 (setnayan-media bucket → `*.r2.dev` /
 * `*.r2.cloudflarestorage.com`) or Supabase Storage (`*.supabase.co`
 * / `*.supabase.in`). Anything else routes to the initials fallback
 * — a missing image renders as initials, never as broken next/image
 * markup. Mirrors the host whitelist the legacy VendorMarketCard
 * used before extraction.
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
    // Demo/seed placeholder host. Already whitelisted in next.config.ts
    // remotePatterns + used by the moodboard library seed; aligning the card
    // guard lets synthetic demo-vendor logos render as a card banner instead
    // of falling back to initials. Real vendors never store picsum URLs.
    host === 'picsum.photos' ||
    host === 'fastly.picsum.photos'
  );
}
