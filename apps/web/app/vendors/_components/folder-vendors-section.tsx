import Image from 'next/image';
import Link from 'next/link';
import { MapPin, Star } from 'lucide-react';

import { createAdminClient } from '@/lib/supabase/admin';
import { formatDistanceKm, haversineKm } from '@/lib/geo';
import { formatStarRating } from '@/lib/reviews';
import {
  findTopVendorsByFolder,
  type VendorPreviewRow,
} from '@/lib/vendor-counts';
import {
  WEDDING_FOLDER_LABEL,
  WEDDING_FOLDER_SLUG,
  type WeddingFolder,
} from '@/lib/taxonomy';

/**
 * Inline real-vendor cards for a marketplace folder, rendered in catalog
 * mode directly under the folder header. Closes the gap surfaced 2026-05-22
 * (CLAUDE.md decision log) where 10 of the 12 folders showed only count-
 * pill category tiles ("5 listed") without naming any of the underlying
 * vendors — couples had to drill into each tile one-by-one to see actual
 * businesses.
 *
 * Mirrors the structural role ReceptionVenuesSection plays for venue_directory
 * cards inside the Reception folder, but reads from vendor_profiles via
 * `vendor_market_stats`. Reception itself doesn't get this section — its 7
 * facet picker + venue_directory cards already serve the role.
 *
 * Sort chain mirrors the vendor-grid default (ad_rank → review_count →
 * rating) so the preview reads consistently with what couples will see
 * when they click "Browse all → " into the full folder grid.
 *
 * Empty-state: when zero vendors match, the section returns null entirely
 * (no awkward "0 vendors" header). The folder's category tiles below still
 * render unconditionally — couples see the breadth even when no vendor
 * signups land yet.
 */
export async function FolderVendorsSection({
  folder,
  excludeVendorIds,
  venueAnchor,
  currentEventId,
  /** When set, render the section as a Setnayan-curated "Featured" strip
   *  with a stronger visual treatment. Reserved for V1.x curation; today
   *  always false and renders the standard surface. */
  featured = false,
  /** Owner directive 2026-05-22 — when TRUE, the host arrived from a
   *  planning card (URL has `?from=plan`). "See all" deep-link appends
   *  `&from=plan` so the destination /vendors view stays in focused
   *  mode (chrome stripped). Direct visits leave false → href is
   *  unchanged from prior behavior. */
  focusedMode = false,
}: {
  folder: WeddingFolder;
  /** Demo-mode exclusion list, threaded through from the page-level
   *  `fetchDemoVendorIds`. When demo mode is on (admin browse), pass []. */
  excludeVendorIds: ReadonlyArray<string>;
  /** Host's reception anchor for the "X km from your venue" chip. */
  venueAnchor: { lat: number; lng: number } | null;
  /** Drives the per-card "Saved" / "Followed" state in a future iteration.
   *  Null on anonymous browse. */
  currentEventId: string | null;
  featured?: boolean;
  focusedMode?: boolean;
}) {
  const admin = createAdminClient();
  const vendors = await findTopVendorsByFolder(admin, {
    folder,
    limit: 9,
    excludeVendorIds,
  });

  // Empty-state — return null so the folder header + tile grid still render
  // without an awkward "0 vendors" surface. This is the expected state pre-
  // pilot for folders where no real vendors have signed up yet; the category
  // tiles still surface the canonical_services as breadth.
  if (vendors.length === 0) return null;

  const folderLabel = WEDDING_FOLDER_LABEL[folder];
  const folderSlug = WEDDING_FOLDER_SLUG[folder];
  const seeAllHref = focusedMode
    ? `/vendors?folder=${folderSlug}&from=plan#${folderSlug}`
    : `/vendors?folder=${folderSlug}#${folderSlug}`;

  return (
    <section
      aria-labelledby={`${folderSlug}-vendors-preview-heading`}
      className={`mb-6 rounded-2xl border p-4 sm:p-5 ${
        featured
          ? 'border-terracotta/40 bg-terracotta/5'
          : 'border-ink/10 bg-cream'
      }`}
    >
      <header className="mb-4 flex items-baseline justify-between gap-3">
        <div className="space-y-1">
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-terracotta">
            {featured ? 'Featured Vendors' : `${folderLabel} Vendors`}
          </p>
          <h2
            id={`${folderSlug}-vendors-preview-heading`}
            className="text-lg font-semibold tracking-tight text-ink sm:text-xl"
          >
            Top {folderLabel.toLowerCase()} vendors right now
          </h2>
        </div>
        <Link
          href={seeAllHref}
          className="hidden shrink-0 text-xs font-medium text-terracotta hover:underline sm:inline"
        >
          See all →
        </Link>
      </header>

      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {vendors.map((vendor) => (
          <li key={vendor.vendor_profile_id}>
            <FolderVendorCard vendor={vendor} venueAnchor={venueAnchor} />
          </li>
        ))}
      </ul>

      <p className="mt-4 sm:hidden">
        <Link
          href={seeAllHref}
          className="text-xs font-medium text-terracotta hover:underline"
        >
          See all {folderLabel.toLowerCase()} vendors →
        </Link>
      </p>
    </section>
  );
}

function FolderVendorCard({
  vendor,
  venueAnchor,
}: {
  vendor: VendorPreviewRow;
  venueAnchor: { lat: number; lng: number } | null;
}) {
  const slug = vendor.business_slug;
  const href = slug ? `/v/${slug}` : '#';
  const initials =
    vendor.business_name
      .split(/\s+/)
      .map((p) => p.charAt(0).toUpperCase())
      .slice(0, 2)
      .join('') || '?';
  const isComingSoon = vendor.public_visibility === 'coming_soon';
  const rating = vendor.avg_rating_overall ?? null;
  const reviewCount = vendor.review_count ?? 0;

  // Distance is only meaningful when both anchor and vendor coords exist.
  const lat = vendor.hq_latitude !== null ? Number(vendor.hq_latitude) : null;
  const lng = vendor.hq_longitude !== null ? Number(vendor.hq_longitude) : null;
  const distanceKm =
    venueAnchor && lat !== null && lng !== null && Number.isFinite(lat) && Number.isFinite(lng)
      ? haversineKm(venueAnchor.lat, venueAnchor.lng, lat, lng)
      : null;

  return (
    <Link
      href={href}
      className="group flex h-full flex-col gap-2 rounded-xl border border-ink/10 bg-cream p-3 transition-colors hover:border-terracotta/50 hover:bg-terracotta/5"
      aria-label={`${vendor.business_name} — view profile`}
    >
      <div className="flex items-start gap-3">
        {vendor.logo_url ? (
          <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-ink/5">
            <Image
              src={vendor.logo_url}
              alt={vendor.business_name}
              fill
              sizes="48px"
              className="object-cover"
            />
          </div>
        ) : (
          <div
            aria-hidden
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-terracotta/10"
          >
            <span className="text-sm font-semibold text-terracotta-700">
              {initials}
            </span>
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-start gap-1.5">
            <h3 className="min-w-0 truncate text-sm font-semibold text-ink group-hover:text-terracotta">
              {vendor.business_name}
            </h3>
            {isComingSoon ? (
              <span className="shrink-0 rounded-full bg-ink/5 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-[0.15em] text-ink/55">
                Coming soon
              </span>
            ) : null}
          </div>
          {vendor.location_city ? (
            <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-ink/45">
              {vendor.location_city}
            </p>
          ) : null}
        </div>
      </div>

      {vendor.tagline ? (
        <p className="line-clamp-2 text-xs text-ink/70">{vendor.tagline}</p>
      ) : null}

      <div className="mt-auto flex flex-wrap items-center gap-2 text-xs text-ink/65">
        {rating !== null && reviewCount > 0 ? (
          <span className="inline-flex items-center gap-1">
            <Star
              aria-hidden
              className="h-3.5 w-3.5 fill-amber-400 text-amber-400"
              strokeWidth={1.75}
            />
            <span className="font-mono text-ink">{formatStarRating(rating)}</span>
            <span className="text-ink/45">({reviewCount})</span>
          </span>
        ) : null}
        {distanceKm !== null ? (
          <span className="inline-flex items-center gap-1">
            <MapPin aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />
            <span className="font-mono">{formatDistanceKm(distanceKm)}</span>
          </span>
        ) : null}
      </div>
    </Link>
  );
}
