import 'server-only';
/**
 * service-card-faces.ts — everything a public grid needs to draw THE service
 * card (`ServiceCardView`), batched over a list of marketplace cards.
 *
 * 🔑 THIS IS THE /explore LANDING GRID'S PIPELINE, lifted verbatim so a second
 * public surface (the /suppliers landing pages) draws the identical card rather
 * than a thinner copy — the exact drift `explore/page.tsx` records fixing in
 * "S43 · 5" (the grid drew a thinner card than the shop page, one click later).
 * Same readers, same fail-soft contracts, same resolvers:
 *   · records + trusted stats only while `cardRecordEnabled()`;
 *   · prices withheld per shop via `fetchVendorsHidingPricesPublicly`;
 *   · the logo through `displayLogoUrl` (stored as `r2://…`, one per SHOP);
 *   · cover + showcase through `publicUrlForStoredAsset` (public, unsigned);
 *   · inclusions, discounts and the Serves line from `vendor-service-public`;
 *   · the card body opens THAT service, the logo opens the shop.
 *
 * ⏭ /explore still carries its own inline copy of this pipeline, because five
 * guards read that file by path (the-logo-opens-the-shop, public-url-takes-a-
 * key-not-a-ref, service-card-cover-fallback, the-generic-signer-is-public-only,
 * explore-shows-what-it-costs). Moving /explore onto this helper is a follow-up
 * that must move those guards with it — not a drive-by.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import type { MarketplaceServiceCard } from '@/lib/marketplace-service-cards';
import { cardRecordEnabled } from '@/lib/card-record-flag';
import {
  cardRecordRatingFromTrusted,
  fetchServiceCardRecords,
  type CompiledCardRecord,
} from '@/lib/service-card-record';
import { fetchTrustedReviewStatsForMany, type TrustedReviewStatsRow } from '@/lib/reviews';
import { fetchVendorsHidingPricesPublicly } from '@/lib/vendor-service-attributes';
import { displayLogoUrl, publicUrlForStoredAsset } from '@/lib/uploads';
import {
  fetchCoveragesByIdPublic,
  fetchDiscountsByServicePublic,
  fetchInclusionsByService,
} from '@/lib/vendor-service-public';
import { buildServesLine } from '@/lib/service-serves-line';
import { toServiceCard, type ServiceCard, type ServiceShowcaseMedia } from '@/lib/service-card-view-model';
import { serviceCardAddress, shopAddress } from '@/lib/service-card-address';
import type { ServiceCardShop } from '@/app/_components/service-card-view';

export type ServiceCardFace = {
  key: string;
  card: ServiceCard;
  detailsHref: string | null;
  shop: ServiceCardShop;
};

export async function buildServiceCardFaces(
  admin: SupabaseClient,
  cards: readonly MarketplaceServiceCard[],
  eventTypeLabel: ReadonlyMap<string, string>,
  now: Date,
): Promise<ServiceCardFace[]> {
  if (cards.length === 0) return [];
  const ids = cards.map((c) => c.row.vendor_service_id);
  const shopIds = [...new Set(cards.map((c) => c.vendorProfileId))];
  const coverageIds = [
    ...new Set(cards.map((c) => c.row.coverage_id).filter((id): id is number => id !== null)),
  ];

  const [records, shopStats, hiding, inclusions, discounts, coverages] = await Promise.all([
    cardRecordEnabled()
      ? fetchServiceCardRecords(admin, ids).catch(() => new Map<string, CompiledCardRecord>())
      : Promise.resolve(new Map<string, CompiledCardRecord>()),
    cardRecordEnabled()
      ? fetchTrustedReviewStatsForMany(admin, shopIds).catch(() => new Map<string, TrustedReviewStatsRow>())
      : Promise.resolve(new Map<string, TrustedReviewStatsRow>()),
    fetchVendorsHidingPricesPublicly(admin, shopIds),
    fetchInclusionsByService(admin, ids),
    fetchDiscountsByServicePublic(admin, ids),
    fetchCoveragesByIdPublic(admin, coverageIds),
  ]);

  // One logo signature per SHOP, not per card.
  const logoRefByShop = new Map<string, string | null>();
  for (const c of cards) if (!logoRefByShop.has(c.vendorProfileId)) logoRefByShop.set(c.vendorProfileId, c.businessLogoRef);
  const logoEntries = [...logoRefByShop.entries()];
  const logoUrls = await Promise.all(logoEntries.map(([, ref]) => displayLogoUrl({ logo_url: ref }).catch(() => null)));
  const logoByShop = new Map(logoEntries.map(([shopId], i) => [shopId, logoUrls[i] ?? null]));

  return cards.map((c) => {
    const id = c.row.vendor_service_id;
    let serves: string | undefined;
    if (c.row.coverage_id !== null) {
      const line = buildServesLine(coverages.get(c.row.coverage_id), eventTypeLabel as Map<string, string>);
      if (line) serves = line;
    }
    const photos = (c.row.showcase_photo_r2_keys ?? [])
      .slice(0, 5)
      .map((k) => publicUrlForStoredAsset(k))
      .filter((u): u is string => Boolean(u));
    const videoUrl = publicUrlForStoredAsset(c.row.showcase_video_r2_key) ?? null;
    const showcase: ServiceShowcaseMedia | undefined =
      photos.length > 0 || videoUrl ? { photos, videoUrl } : undefined;

    return {
      key: id,
      card: toServiceCard(
        c.row,
        inclusions.get(id),
        discounts.get(id),
        serves,
        showcase,
        hiding.has(c.vendorProfileId),
        null,
        now,
        records.get(id) ?? null,
        cardRecordRatingFromTrusted(shopStats.get(c.vendorProfileId)),
        false,
        publicUrlForStoredAsset(c.row.primary_photo_r2_key) ?? null,
      ),
      detailsHref: serviceCardAddress(c),
      shop: {
        name: c.businessName,
        href: shopAddress(c.businessSlug),
        logoUrl: logoByShop.get(c.vendorProfileId) ?? null,
        city: c.locationCity,
      },
    };
  });
}
