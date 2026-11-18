import 'server-only';

/**
 * marketplace-service-card-faces.ts — EVERYTHING a marketplace service card needs beyond its own row, read ONCE per
 * batch, for every surface that draws the shipped `ServiceCardView` from `fetchMarketplaceServiceCards`.
 *
 * Lifted out of the supplier view (`app/(shell)/explore/_lib/marketplace-view.tsx`) when Discover grew its own
 * Service cards shelf (owner 16 Nov, "Discover in six parts"). That grid had already paid, one defect at a time, for
 * drawing a THINNER card than the shop page one click later — no logo (SUP-41), no record and printed prices a shop
 * had chosen to hide (SUP-41), no cover (C2), no inclusions / discount / Serves line / showcase (S43 · 5). A second
 * grid copying that block would inherit whichever of those it forgot, so both read through here.
 *
 * Every read fails soft to "nothing extra", never to an empty grid: a missing piece renders the card as it would
 * have rendered without it. The one exception is the price choice, which fails OPEN exactly as
 * `fetchVendorsHidingPricesPublicly` decides — that is that reader's own contract, not this file's.
 *
 * ⚖ Image addresses are PUBLIC, not presigned (`publicUrlForStoredAsset`, whose docblock names this grid); the logo is
 * the one exception, resolved per SHOP through `displayLogoUrl`, because `logo_url` holds `r2://`, not a URL.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import type { MarketplaceServiceCard } from '@/lib/marketplace-service-cards';
import { fetchDiscountsWithOffers } from '@/lib/offers.server';
import { fetchTrustedReviewStatsForMany, type TrustedReviewStatsRow } from '@/lib/reviews';
import { cardRecordEnabled } from '@/lib/card-record-flag';
import { cardRecordRatingFromTrusted, fetchServiceCardRecords, type CompiledCardRecord } from '@/lib/service-card-record';
import { serviceCardAddress, shopAddress } from '@/lib/service-card-address';
import { toServiceCard, type ServiceCard, type ServiceShowcaseMedia } from '@/lib/service-card-view-model';
import {
  fetchCoveragesByIdPublic,
  fetchInclusionsByService,
  type VendorServiceCoverage,
  type VendorServiceInclusion,
} from '@/lib/vendor-service-public';
import type { VendorServiceDiscount } from '@/lib/vendor-services';
import { buildServesLine } from '@/lib/service-serves-line';
import { fetchVendorsHidingPricesPublicly } from '@/lib/vendor-service-attributes';
import { displayServiceLabel } from '@/lib/vendors';
import { displayLogoUrl, publicUrlForStoredAsset } from '@/lib/uploads';

/** The `ServiceCardView` props for one marketplace card (minus `detailsEnabled`, which is the caller's). */
export type MarketplaceCardFace = {
  card: ServiceCard;
  detailsHref: string | null;
  path: string | null;
  coverUrl: string | null;
  shop: {
    name: string;
    href: string | null;
    logoUrl: string | null;
    city: string | null;
    isDemo: boolean;
    verified?: boolean;
  };
};

/**
 * Read every card's face in one batch and return a pure `faceFor(card)`. `eventTypeLabel` names the event types in the
 * Serves line ("Weddings · Debuts"); `now` is the render's single clock.
 */
export async function readMarketplaceCardFaces(
  admin: SupabaseClient,
  cards: readonly MarketplaceServiceCard[],
  eventTypeLabel: ReadonlyMap<string, string>,
  now: Date,
): Promise<(c: MarketplaceServiceCard) => MarketplaceCardFace> {
  const serviceIds = cards.map((c) => c.row.vendor_service_id);
  const shopIds = [...new Set(cards.map((c) => c.vendorProfileId))];
  const coverageIds = [...new Set(cards.map((c) => c.row.coverage_id).filter((id): id is number => id !== null))];

  const [serviceCardInclusions, serviceCardDiscounts, coverages, serviceCardRecords, shopStats, serviceCardHidingPrices] = cards.length
    ? await Promise.all([
        fetchInclusionsByService(admin, serviceIds),
        // 🏷 the cards' own rows + the shop's running offers (Build 6 Lane D) — couples see the single best of both.
        fetchDiscountsWithOffers(admin, serviceIds),
        fetchCoveragesByIdPublic(admin, coverageIds),
        cardRecordEnabled()
          ? fetchServiceCardRecords(admin, serviceIds).catch(() => new Map<string, CompiledCardRecord>())
          : Promise.resolve(new Map<string, CompiledCardRecord>()),
        cardRecordEnabled()
          ? fetchTrustedReviewStatsForMany(admin, shopIds).catch(() => new Map<string, TrustedReviewStatsRow>())
          : Promise.resolve(new Map<string, TrustedReviewStatsRow>()),
        fetchVendorsHidingPricesPublicly(admin, shopIds),
      ])
    : [
        new Map<string, VendorServiceInclusion[]>(),
        new Map<string, VendorServiceDiscount[]>(),
        new Map<number, VendorServiceCoverage>(),
        new Map<string, CompiledCardRecord>(),
        new Map<string, TrustedReviewStatsRow>(),
        new Set<string>(),
      ];

  // ═ THE LOGO, ONCE PER SHOP — `logo_url` holds `r2://`, never a URL; `displayLogoUrl` is its one resolver. ═
  const byShop = new Map<string, string | null>();
  for (const c of cards) if (!byShop.has(c.vendorProfileId)) byShop.set(c.vendorProfileId, c.businessLogoRef);
  const shops = [...byShop.entries()];
  const resolved = await Promise.all(shops.map(([, ref]) => displayLogoUrl({ logo_url: ref }).catch(() => null)));
  const serviceCardLogoUrls = new Map(shops.map(([id], i) => [id, resolved[i] ?? null]));

  const serviceCardServes = new Map<string, string>();
  const serviceCardShowcase = new Map<string, ServiceShowcaseMedia>();
  for (const c of cards) {
    const id = c.row.vendor_service_id;
    if (c.row.coverage_id !== null) {
      const line = buildServesLine(coverages.get(c.row.coverage_id), eventTypeLabel);
      if (line) serviceCardServes.set(id, line);
    }
    const photos = (c.row.showcase_photo_r2_keys ?? [])
      .slice(0, 5)
      .map((k) => publicUrlForStoredAsset(k))
      .filter((u): u is string => Boolean(u));
    const videoUrl = publicUrlForStoredAsset(c.row.showcase_video_r2_key) ?? null;
    if (photos.length > 0 || videoUrl) serviceCardShowcase.set(id, { photos, videoUrl });
  }

  return (c) => {
    const coverUrl = publicUrlForStoredAsset(c.row.primary_photo_r2_key);
    return {
      card: toServiceCard(
        c.row,
        serviceCardInclusions.get(c.row.vendor_service_id),
        serviceCardDiscounts.get(c.row.vendor_service_id),
        serviceCardServes.get(c.row.vendor_service_id),
        serviceCardShowcase.get(c.row.vendor_service_id),
        serviceCardHidingPrices.has(c.vendorProfileId),
        null,
        now,
        serviceCardRecords.get(c.row.vendor_service_id) ?? null,
        cardRecordRatingFromTrusted(shopStats.get(c.vendorProfileId)),
        false,
        coverUrl,
      ),
      detailsHref: serviceCardAddress(c),
      path: displayServiceLabel(c.row.category),
      coverUrl,
      shop: {
        name: c.businessName,
        href: shopAddress(c.businessSlug),
        logoUrl: serviceCardLogoUrls.get(c.vendorProfileId) ?? null,
        city: c.locationCity,
        isDemo: c.isDemo,
        verified: c.verified,
      },
    };
  };
}
