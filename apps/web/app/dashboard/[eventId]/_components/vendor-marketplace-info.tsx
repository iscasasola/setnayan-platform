// ============================================================================
// VendorMarketplaceInfo — Services · Contact · Reviews surfaces on the
// per-vendor workspace page when the vendor is marketplace-linked.
//
// Owner directive 2026-05-22 (verbatim):
//   "For marketplace-linked vendors (event_vendors row with marketplace_vendor_id
//    set), the dedicated vendor page should also surface full profile info
//    from the marketplace: services (vendor_services), contact information
//    (phone, email, website from vendor_profiles), reviews (vendor_reviews).
//    Currently the page is sparse for marketplace vendors too."
//
// Three cards rendered as a stacked group below the existing Payments /
// Documents / Schedules grid. Each card empty-states politely if the data
// doesn't exist (no services published, no public contact, no reviews yet).
//
// Graceful degradation:
//   - Catches Postgres 42P01 (undefined table) + 42703 (undefined column)
//     when prod doesn't yet have a given migration applied. Each section
//     skips silently — the workspace page keeps rendering.
//   - All three lookups happen server-side via the regular RLS-scoped
//     client. vendor_profiles, vendor_services, vendor_reviews, and the
//     vendor_review_stats view all expose public read for marketplace
//     consumption (per 20260514100000_vendor_reviews.sql + sibling
//     migrations).
//
// V1 scope: READ ONLY. The "Leave a review" flow lives on the dedicated
// /vendors/[eventVendorId]/review page (existing). This component just
// surfaces what the marketplace already has.
//
// Entry points (orphan-prevention per feedback_setnayan_orphan_prevention):
//   - vendors/[eventVendorId]/workspace/page.tsx renders this once for any
//     event_vendors row whose marketplace_vendor_id is set + the
//     marketplaceProfile fetch returns data.
// ============================================================================

import Link from 'next/link';
import {
  Mail,
  Phone,
  Globe,
  Star,
  Sparkles,
  AlertCircle,
} from 'lucide-react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { formatPhp } from '@/lib/vendors';
import { serviceCategoryKeyLabel } from '@/lib/service-category-keys';
import {
  type VendorServiceRow,
} from '@/lib/vendor-services';
import {
  REVIEW_AXIS_LABEL,
  type ReviewAxis,
  formatStarRating,
  type ReviewWithCouple,
  type ReviewStatsRow,
} from '@/lib/reviews';

// ----------------------------------------------------------------------------
// Server-side fetch helpers
//
// Wrapped in dedicated functions instead of inlined in the workspace page so
// (a) the workspace page reads cleanly + (b) each section can independently
// fail silently. The 42P01 / 42703 graceful-degrade pattern matches the
// existing budget.ts buildVendorPricingLookup() approach (see
// CLAUDE.md 2026-05-20 row 450 + feedback_setnayan_latest_spec_priority).
// ----------------------------------------------------------------------------

export type MarketplaceContact = {
  contact_email: string | null;
  contact_phone: string | null;
  website: string | null;
  location_city: string | null;
};

function isMissingRelation(error: { code?: string } | null | undefined): boolean {
  return error?.code === '42P01' || error?.code === '42703';
}

/**
 * Fetch contact + display fields off vendor_profiles. Returns null when the
 * row is missing or RLS denies. Graceful 42P01 / 42703 → null.
 *
 * Read-only fields only — the workspace page already pulls business_name
 * + logo_url for the header from the same row earlier in the request, so
 * this helper deliberately returns the subset the new Contact card needs.
 */
export async function fetchMarketplaceContact(
  supabase: SupabaseClient,
  vendorProfileId: string,
): Promise<MarketplaceContact | null> {
  try {
    const { data, error } = await supabase
      .from('vendor_profiles')
      .select('contact_email, contact_phone, website, location_city')
      .eq('vendor_profile_id', vendorProfileId)
      .maybeSingle();
    if (error) {
      if (isMissingRelation(error)) return null;
      // Soft-fail on RLS or transient errors — log + skip the section.
      // eslint-disable-next-line no-console
      console.error('[fetchMarketplaceContact] error', error.message);
      return null;
    }
    return (data ?? null) as MarketplaceContact | null;
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error('[fetchMarketplaceContact] threw', e);
    return null;
  }
}

/**
 * Fetch active vendor_services rows. Empty array on any failure (table missing,
 * RLS, transient). Drives the Services card.
 */
export async function fetchMarketplaceServices(
  supabase: SupabaseClient,
  vendorProfileId: string,
): Promise<VendorServiceRow[]> {
  try {
    const { data, error } = await supabase
      .from('vendor_services')
      .select(
        'vendor_service_id,public_id,vendor_profile_id,category,starting_price_php,crew_size,crew_meal_required,is_active,created_at,updated_at',
      )
      .eq('vendor_profile_id', vendorProfileId)
      .eq('is_active', true)
      .order('created_at', { ascending: true });
    if (error) {
      if (isMissingRelation(error)) return [];
      // eslint-disable-next-line no-console
      console.error('[fetchMarketplaceServices] error', error.message);
      return [];
    }
    return (data ?? []) as VendorServiceRow[];
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error('[fetchMarketplaceServices] threw', e);
    return [];
  }
}

export type MarketplaceReviewsData = {
  stats: ReviewStatsRow;
  reviews: ReviewWithCouple[];
};

/**
 * Fetch up to 5 most-recent reviews + the stats row. Graceful-degrades each
 * piece independently — if vendor_reviews exists but the stats view doesn't,
 * the reviews still render with a zeroed stats fallback.
 */
export async function fetchMarketplaceReviews(
  supabase: SupabaseClient,
  vendorProfileId: string,
): Promise<MarketplaceReviewsData> {
  const fallbackStats: ReviewStatsRow = {
    vendor_profile_id: vendorProfileId,
    avg_rating_overall: 0,
    total_count: 0,
    count_5_star: 0,
    count_4_star: 0,
    count_3_star: 0,
    count_2_star: 0,
    count_1_star: 0,
  };

  let stats = fallbackStats;
  let reviews: ReviewWithCouple[] = [];

  try {
    const statsRes = await supabase
      .from('vendor_review_stats')
      .select(
        'vendor_profile_id,avg_rating_overall,total_count,count_5_star,count_4_star,count_3_star,count_2_star,count_1_star',
      )
      .eq('vendor_profile_id', vendorProfileId)
      .maybeSingle();
    if (!statsRes.error && statsRes.data) {
      stats = {
        vendor_profile_id: statsRes.data.vendor_profile_id as string,
        avg_rating_overall: Number(statsRes.data.avg_rating_overall ?? 0),
        total_count: Number(statsRes.data.total_count ?? 0),
        count_5_star: Number(statsRes.data.count_5_star ?? 0),
        count_4_star: Number(statsRes.data.count_4_star ?? 0),
        count_3_star: Number(statsRes.data.count_3_star ?? 0),
        count_2_star: Number(statsRes.data.count_2_star ?? 0),
        count_1_star: Number(statsRes.data.count_1_star ?? 0),
      };
    }
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error('[fetchMarketplaceReviews] stats threw', e);
  }

  try {
    const reviewsRes = await supabase
      .from('vendor_reviews')
      .select(
        'review_id,public_id,vendor_profile_id,event_id,couple_user_id,rating_overall,rating_communication,rating_quality,rating_value,rating_on_time,body,vendor_reply,vendor_reply_at,created_at',
      )
      .eq('vendor_profile_id', vendorProfileId)
      .order('created_at', { ascending: false })
      .limit(5);
    if (!reviewsRes.error && reviewsRes.data) {
      const baseReviews = reviewsRes.data as Array<{
        review_id: string;
        public_id: string;
        vendor_profile_id: string;
        event_id: string;
        couple_user_id: string | null;
        rating_overall: number;
        rating_communication: number;
        rating_quality: number;
        rating_value: number;
        rating_on_time: number;
        body: string | null;
        vendor_reply: string | null;
        vendor_reply_at: string | null;
        created_at: string;
      }>;

      // Resolve display names — keep this best-effort. A missing users row
      // surfaces as "Verified couple".
      const userIds = Array.from(
        new Set(baseReviews.map((r) => r.couple_user_id).filter((id): id is string => !!id)),
      );
      const nameById = new Map<string, string | null>();
      if (userIds.length > 0) {
        try {
          const usersRes = await supabase
            .from('users')
            .select('user_id, display_name')
            .in('user_id', userIds);
          if (!usersRes.error) {
            for (const row of usersRes.data ?? []) {
              nameById.set(
                row.user_id as string,
                (row.display_name as string | null) ?? null,
              );
            }
          }
        } catch {
          // best-effort — fallback to "Verified couple"
        }
      }

      reviews = baseReviews.map((r) => ({
        ...r,
        couple_display_name: r.couple_user_id ? (nameById.get(r.couple_user_id) ?? null) : null,
      }));
    }
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error('[fetchMarketplaceReviews] reviews threw', e);
  }

  return { stats, reviews };
}

// ----------------------------------------------------------------------------
// Rendered surfaces
// ----------------------------------------------------------------------------

export type VendorMarketplaceInfoProps = {
  services: VendorServiceRow[];
  contact: MarketplaceContact | null;
  reviewsData: MarketplaceReviewsData;
  vendorBusinessName: string;
  vendorProfileSlug: string | null;
  /**
   * The /dashboard/[eventId]/vendors/[eventVendorId]/review route — surfaced
   * as the "Write a review" CTA on the Reviews card once the booking is
   * delivered/complete. The page already gates the route on delivered status
   * (see /review/page.tsx + reviews/actions.ts), so this is purely a deep-
   * link convenience.
   */
  reviewLinkHref: string | null;
};

export function VendorMarketplaceInfo({
  services,
  contact,
  reviewsData,
  vendorBusinessName,
  vendorProfileSlug,
  reviewLinkHref,
}: VendorMarketplaceInfoProps) {
  // If literally every section has zero data AND no contact, render nothing
  // — the workspace page has plenty of empty real estate already and a card
  // grid of empty-states reads as broken even if every individual empty
  // state copy is polite.
  const hasAnything =
    services.length > 0 ||
    (contact !== null &&
      (contact.contact_email || contact.contact_phone || contact.website)) ||
    reviewsData.stats.total_count > 0;
  if (!hasAnything) {
    // Still render the Services + Reviews polite-empty surfaces so the host
    // knows what's coming, but suppress the Contact card when there's no
    // contact data. Mirrors the public profile UX on /v/[slug] which only
    // surfaces contact links when fields are set.
    return (
      <div className="grid gap-5 lg:grid-cols-2">
        <ServicesCard services={services} vendorBusinessName={vendorBusinessName} />
        <ReviewsCard
          data={reviewsData}
          vendorBusinessName={vendorBusinessName}
          vendorProfileSlug={vendorProfileSlug}
          reviewLinkHref={reviewLinkHref}
        />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="grid gap-5 lg:grid-cols-2">
        <ServicesCard services={services} vendorBusinessName={vendorBusinessName} />
        <ContactCard contact={contact} vendorBusinessName={vendorBusinessName} />
      </div>
      <ReviewsCard
        data={reviewsData}
        vendorBusinessName={vendorBusinessName}
        vendorProfileSlug={vendorProfileSlug}
        reviewLinkHref={reviewLinkHref}
      />
    </div>
  );
}

// ----------------------------------------------------------------------------
// Services card
// ----------------------------------------------------------------------------

function ServicesCard({
  services,
  vendorBusinessName,
}: {
  services: VendorServiceRow[];
  vendorBusinessName: string;
}) {
  return (
    <section
      id="vendor-services"
      aria-labelledby="vendor-services-heading"
      className="space-y-3 rounded-xl border border-ink/10 bg-cream/60 p-5"
    >
      <header className="flex items-center justify-between gap-3">
        <h2
          id="vendor-services-heading"
          className="flex items-center gap-2 text-sm font-semibold text-ink"
        >
          <Sparkles aria-hidden className="h-4 w-4 text-terracotta" strokeWidth={1.75} />
          Services
        </h2>
      </header>

      {services.length === 0 ? (
        <p className="text-xs text-ink/55">
          {vendorBusinessName} hasn&rsquo;t published a service list yet. Ask them
          in chat — final quotes happen there anyway.
        </p>
      ) : (
        <ul className="space-y-2">
          {services.map((s) => (
            <li key={s.vendor_service_id}>
              <ServiceRow row={s} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function ServiceRow({ row }: { row: VendorServiceRow }) {
  // Cross-vocabulary label: tile / legacy keys resolve via the constants,
  // canonical keys humanize ('lechon_belly' → 'Lechon belly') — never the
  // raw underscore key the legacy-only resolver leaked.
  const label = serviceCategoryKeyLabel(row.category);
  const priceLabel =
    row.starting_price_php !== null && row.starting_price_php > 0
      ? `from ${formatPhp(row.starting_price_php)}`
      : 'Inquire';
  const crewParts: string[] = [];
  if (row.crew_size !== null && row.crew_size > 0) {
    crewParts.push(`${row.crew_size} crew on-site`);
  }
  if (row.crew_meal_required) {
    crewParts.push('crew meal required');
  }
  return (
    <div className="rounded-lg border border-ink/10 bg-cream/80 px-3 py-2">
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-sm font-medium text-ink">{label}</p>
        <p className="font-mono text-xs text-ink/75">{priceLabel}</p>
      </div>
      {crewParts.length > 0 ? (
        <p className="mt-0.5 text-[11px] text-ink/55">{crewParts.join(' · ')}</p>
      ) : null}
    </div>
  );
}

// ----------------------------------------------------------------------------
// Contact card
// ----------------------------------------------------------------------------

function ContactCard({
  contact,
  vendorBusinessName,
}: {
  contact: MarketplaceContact | null;
  vendorBusinessName: string;
}) {
  const hasAny =
    contact !== null &&
    (contact.contact_email || contact.contact_phone || contact.website);

  return (
    <section
      id="vendor-contact"
      aria-labelledby="vendor-contact-heading"
      className="space-y-3 rounded-xl border border-ink/10 bg-cream/60 p-5"
    >
      <header className="flex items-center justify-between gap-3">
        <h2
          id="vendor-contact-heading"
          className="flex items-center gap-2 text-sm font-semibold text-ink"
        >
          <Mail aria-hidden className="h-4 w-4 text-terracotta" strokeWidth={1.75} />
          Contact
        </h2>
      </header>

      {!hasAny ? (
        <p className="text-xs text-ink/55">
          {vendorBusinessName} hasn&rsquo;t added public contact details. Reach
          them through chat instead.
        </p>
      ) : (
        <ul className="space-y-2">
          {contact?.contact_phone ? (
            <li>
              <a
                href={`tel:${contact.contact_phone.replace(/\s/g, '')}`}
                className="inline-flex items-center gap-2 text-sm text-ink hover:text-terracotta focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-terracotta"
              >
                <Phone aria-hidden className="h-3.5 w-3.5 text-ink/55" strokeWidth={1.75} />
                {contact.contact_phone}
              </a>
            </li>
          ) : null}
          {contact?.contact_email ? (
            <li>
              <a
                href={`mailto:${contact.contact_email}`}
                className="inline-flex items-center gap-2 text-sm text-ink hover:text-terracotta focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-terracotta"
              >
                <Mail aria-hidden className="h-3.5 w-3.5 text-ink/55" strokeWidth={1.75} />
                {contact.contact_email}
              </a>
            </li>
          ) : null}
          {contact?.website ? (
            <li>
              <a
                href={contact.website}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-sm text-ink hover:text-terracotta focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-terracotta"
              >
                <Globe aria-hidden className="h-3.5 w-3.5 text-ink/55" strokeWidth={1.75} />
                Website
              </a>
            </li>
          ) : null}
          {contact?.location_city ? (
            <li className="text-xs text-ink/55">{contact.location_city}</li>
          ) : null}
        </ul>
      )}
    </section>
  );
}

// ----------------------------------------------------------------------------
// Reviews card — compact hero metric + up to 5 most recent
// ----------------------------------------------------------------------------

function ReviewsCard({
  data,
  vendorBusinessName,
  vendorProfileSlug,
  reviewLinkHref,
}: {
  data: MarketplaceReviewsData;
  vendorBusinessName: string;
  vendorProfileSlug: string | null;
  reviewLinkHref: string | null;
}) {
  const { stats, reviews } = data;
  return (
    <section
      id="vendor-reviews"
      aria-labelledby="vendor-reviews-heading"
      className="space-y-4 rounded-xl border border-ink/10 bg-cream/60 p-5"
    >
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h2
          id="vendor-reviews-heading"
          className="flex items-center gap-2 text-sm font-semibold text-ink"
        >
          <Star aria-hidden className="h-4 w-4 text-terracotta" strokeWidth={1.75} />
          Reviews
        </h2>
        {vendorProfileSlug ? (
          <Link
            href={`/v/${vendorProfileSlug}#reviews`}
            className="text-[11px] font-medium text-terracotta-700 hover:text-terracotta-800"
            target="_blank"
            rel="noopener noreferrer"
          >
            See all
          </Link>
        ) : null}
      </header>

      <ReviewsHero stats={stats} />

      {reviews.length === 0 ? (
        <div className="rounded-md border border-dashed border-ink/15 bg-cream/40 px-3 py-3">
          <p className="text-xs text-ink/65">
            {vendorBusinessName} still has no review.
          </p>
          <p className="mt-1 text-[11px] text-ink/45">
            Bookings through Setnayan generate a review request 24 hours after
            the event.
          </p>
          {reviewLinkHref ? (
            <Link
              href={reviewLinkHref}
              className="mt-2 inline-flex items-center gap-1 text-[11px] font-medium text-terracotta-700 hover:text-terracotta-800"
            >
              Write a review
            </Link>
          ) : null}
        </div>
      ) : (
        <ul className="space-y-2.5">
          {reviews.map((r) => (
            <li key={r.review_id}>
              <ReviewRow review={r} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function ReviewsHero({ stats }: { stats: ReviewStatsRow }) {
  const hero = stats.avg_rating_overall;
  if (stats.total_count === 0) {
    return (
      <div className="flex items-center gap-3 rounded-md bg-cream/40 px-3 py-2">
        <Star className="h-5 w-5 text-ink/25" strokeWidth={1.5} />
        <span className="text-xs text-ink/55">No reviews yet.</span>
      </div>
    );
  }
  return (
    <div className="flex items-center gap-3 rounded-md bg-cream/40 px-3 py-2">
      <Star
        className={`h-5 w-5 ${hero > 0 ? 'fill-amber-400 text-amber-500' : 'text-ink/25'}`}
        strokeWidth={1.5}
      />
      <span className="text-xl font-semibold text-ink">
        {hero > 0 ? formatStarRating(hero) : '—'}
      </span>
      <span className="text-xs text-ink/60">
        {stats.total_count} review{stats.total_count === 1 ? '' : 's'}
      </span>
    </div>
  );
}

const AXIS_ORDER: ReadonlyArray<ReviewAxis> = [
  'communication',
  'quality',
  'value',
  'on_time',
];

function ReviewRow({ review }: { review: ReviewWithCouple }) {
  const author =
    review.couple_display_name && review.couple_display_name.trim().length > 0
      ? review.couple_display_name
      : 'Verified couple';
  const dateLabel = new Date(review.created_at).toLocaleDateString('en-PH', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
  return (
    <article className="rounded-lg border border-ink/10 bg-cream/80 px-3 py-2.5">
      <header className="flex flex-wrap items-baseline justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <Star
            className="h-3.5 w-3.5 fill-amber-400 text-amber-500"
            strokeWidth={1.5}
          />
          <span className="text-sm font-semibold text-ink">
            {formatStarRating(review.rating_overall)}
          </span>
        </div>
        <p className="text-[11px] text-ink/55">
          {author} · {dateLabel}
        </p>
      </header>
      {review.body ? (
        <p className="mt-1.5 line-clamp-3 text-xs text-ink/80">{review.body}</p>
      ) : null}
      <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-0.5 sm:grid-cols-4">
        {AXIS_ORDER.map((axis) => {
          const value =
            axis === 'communication'
              ? review.rating_communication
              : axis === 'quality'
                ? review.rating_quality
                : axis === 'value'
                  ? review.rating_value
                  : review.rating_on_time;
          return (
            <div key={axis} className="flex items-baseline gap-1">
              <dt className="text-[10px] text-ink/45">{REVIEW_AXIS_LABEL[axis]}</dt>
              <dd className="font-mono text-[11px] text-ink/75">
                {formatStarRating(value)}
              </dd>
            </div>
          );
        })}
      </dl>
      {review.vendor_reply ? (
        <div className="mt-2 rounded-md border border-terracotta/15 bg-terracotta/[0.04] px-2.5 py-1.5">
          <div className="flex items-center gap-1">
            <AlertCircle
              aria-hidden
              className="h-3 w-3 text-terracotta"
              strokeWidth={1.75}
            />
            <span className="font-mono text-[10px] uppercase tracking-[0.15em] text-terracotta-700">
              Vendor reply
            </span>
          </div>
          <p className="mt-1 line-clamp-3 text-[11px] text-ink/75">{review.vendor_reply}</p>
        </div>
      ) : null}
    </article>
  );
}
