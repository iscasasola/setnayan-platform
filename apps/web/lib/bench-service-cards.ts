import 'server-only';
/**
 * bench-service-cards.ts — reads the suppliers' own service cards for the
 * couple's Suppliers page, batched (owner 2026-10-07 · PR2 "service cards in
 * the rows").
 *
 * Two questions, one pipeline:
 *   · `fetchBenchServiceCards`   — the cards the couple's OWN picks point at
 *     (`event_vendors.service_id`, read through the couple's own session by the
 *     caller, so membership is proved before this is asked anything);
 *   · `fetchMarketCategoryCards` — EVERY card of the marketplace suppliers inside
 *     a category, for the "More to compare" list under a row (Find v4, 2026-10-29);
 *     `firstCardPerSupplier` derives the one-per-supplier record from it.
 *
 * 🔑 THE ADMIN CLIENT IS PASSED IN, AND ONLY PUBLISHED CARDS LEAVE. A couple
 * holds no RLS read on `vendor_services`; the fields read here are the ones the
 * supplier already publishes on their shop page (the same client split as
 * `fetchVendorPhotoMaps` on the page and `lib/offered-service-card.ts`). Only
 * ACTIVE cards are returned, and `benchServiceCard` withholds every peso figure
 * for a shop that hides its prices publicly.
 *
 * 🔑 A FAILED READ IS `null`, NEVER `{}`. An empty record means "these
 * suppliers have no card" and the page then says "Price on request"; a read
 * that failed must not be allowed to say that. `null` makes the card draw
 * nothing about a service card at all.
 *
 * ⚠ MEDIA IS A STORED REF, NEVER A URL — every cover goes through
 * `publicUrlForStoredAsset` (the same resolver the page's photo ladder uses).
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { publicUrlForStoredAsset } from '@/lib/uploads';
import {
  fetchBracketsByService,
  fetchDiscountsByService,
  fetchInclusionsByService,
} from '@/lib/vendor-services';
import { fetchVendorsHidingPricesPublicly } from '@/lib/vendor-service-attributes';
import { benchServiceCard, type BenchServiceCard } from '@/lib/bench-service-card';
import { cheapestStartsAt } from '@/lib/smart-sort';
import type { FindCardRow } from '@/lib/find-service-cards';
import { serviceCardAddress } from '@/lib/service-card-address';
import { serviceDetailsEnabled } from '@/lib/service-details-flag';

type CardRow = {
  vendor_service_id: string;
  public_id?: string | null;
  vendor_profile_id: string;
  title: string | null;
  category: string | null;
  pricing_basis: string | null;
  starting_price_php: number | null;
  per_pax_price_php: number | null;
  min_pax: number | null;
  hour_base_php: number | null;
  min_hours: number | null;
  extra_hour_php: number | null;
  crew_meal_included: boolean | null;
  transport_included: boolean | null;
  transport_flat_fee_php: number | null;
  exclusive_perk_text: string | null;
  includes_setnayan_gift: boolean | null;
  primary_photo_r2_key: string | null;
  showcase_photo_r2_keys?: string[] | null;
  base_pax?: number | null;
  added_pax_block?: number | null;
  added_pax_price_php?: number | null;
  created_at?: string | null;
};

/** What the bench card prints from a service card — nothing else is read. */
const BENCH_CARD_FIELDS =
  'vendor_service_id,public_id,vendor_profile_id,title,category,pricing_basis,starting_price_php,' +
  'per_pax_price_php,min_pax,hour_base_php,min_hours,extra_hour_php,crew_meal_included,' +
  'transport_included,transport_flat_fee_php,exclusive_perk_text,includes_setnayan_gift,' +
  'primary_photo_r2_key,showcase_photo_r2_keys';

/** service id → the card, for rows already read. */
async function cardsForRows(
  admin: SupabaseClient,
  rows: readonly CardRow[],
  now: Date,
): Promise<Map<string, BenchServiceCard>> {
  const out = new Map<string, BenchServiceCard>();
  if (rows.length === 0) return out;
  const ids = rows.map((r) => r.vendor_service_id);
  const shopIds = [...new Set(rows.map((r) => r.vendor_profile_id))];
  const [discounts, inclusions, brackets, hiding, slugs] = await Promise.all([
    fetchDiscountsByService(admin, ids),
    fetchInclusionsByService(admin, ids),
    fetchBracketsByService(admin, ids),
    fetchVendorsHidingPricesPublicly(admin, shopIds),
    // 🃏 Only when the grown card is switched on — OFF costs not one extra query, and the card keeps the Find sheet.
    serviceDetailsEnabled() ? fetchShopSlugs(admin, shopIds) : Promise.resolve(new Map<string, string>()),
  ]);
  for (const row of rows) {
    out.set(row.vendor_service_id, {
      ...benchServiceCard({
        service: row,
        discounts: discounts.get(row.vendor_service_id) ?? [],
        inclusions: inclusions.get(row.vendor_service_id) ?? [],
        brackets: brackets.get(row.vendor_service_id) ?? [],
        hidePrices: hiding.has(row.vendor_profile_id),
        coverUrl: publicUrlForStoredAsset(row.primary_photo_r2_key),
        // 🎞 The showcase photos the cover plays (≤5, the grown card's cap) — same read, no extra request.
        photos: (row.showcase_photo_r2_keys ?? [])
          .slice(0, 5)
          .map((k) => publicUrlForStoredAsset(k))
          .filter((u): u is string => Boolean(u)),
        now,
      }),
      // 🃏 SERVICE CARD GROWN (owner 2026-11-13, rejecting a Find-only drawing): the card opens THE shipped grown card
      // — the shop page's own `?service=` address, the same door the marketplace card uses. Null → the Find sheet.
      detailsHref: row.public_id?.trim()
        ? serviceCardAddress({ businessSlug: slugs.get(row.vendor_profile_id) ?? null, row })
        : null,
    });
  }
  return out;
}

/** shop id → its public slug, for the grown card's address. A failed read is an empty map: every card keeps the Find
 *  sheet, never a link to nowhere. */
async function fetchShopSlugs(admin: SupabaseClient, shopIds: readonly string[]): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  if (shopIds.length === 0) return out;
  const { data, error } = await admin
    .from('vendor_profiles')
    .select('vendor_profile_id,business_slug')
    .in('vendor_profile_id', [...shopIds]);
  if (error || !data) return out;
  for (const r of data as { vendor_profile_id: string; business_slug: string | null }[]) {
    if (r.business_slug?.trim()) out.set(r.vendor_profile_id, r.business_slug.trim());
  }
  return out;
}

/**
 * The couple's own picks: pick id → the service card it points at.
 *
 * `serviceIdByVendorId` MUST come from the couple's own RLS-scoped read of
 * their event's picks — that read is what proves they may see these cards.
 * A pick whose card is switched off, or which points at no card, is simply
 * absent. `null` = the read failed.
 */
export async function fetchBenchServiceCards(
  admin: SupabaseClient,
  serviceIdByVendorId: ReadonlyMap<string, string>,
  now: Date,
): Promise<Record<string, BenchServiceCard> | null> {
  const serviceIds = [...new Set(serviceIdByVendorId.values())];
  if (serviceIds.length === 0) return {};
  try {
    const { data, error } = await admin
      .from('vendor_services')
      .select(BENCH_CARD_FIELDS)
      .in('vendor_service_id', serviceIds)
      .eq('is_active', true);
    if (error) {
      console.error('[bench-service-cards] picks: vendor_services read failed', error);
      return null;
    }
    const cards = await cardsForRows(admin, (data ?? []) as unknown as CardRow[], now);
    const out: Record<string, BenchServiceCard> = {};
    for (const [vendorId, serviceId] of serviceIdByVendorId) {
      const card = cards.get(serviceId);
      if (card) out[vendorId] = card;
    }
    return out;
  } catch (err) {
    console.error('[bench-service-cards] picks: read threw', err);
    return null;
  }
}

/**
 * EVERY card of the given suppliers inside a category (owner 2026-10-29, Find v4: *"all service cards of all services
 * inside a category will share the same spot"*) — one row per `vendor_services` row, each under its ONE home service
 * (`category`), oldest first. `null` = the read failed (the list then says it could not load the cards, never "none").
 *
 * `fromPhp` is the card's own starting price for the ⇅ Price choice — read only where the card PRINTS a price, so a
 * shop that hides its prices is never placed in a price band by a figure it chose not to show.
 */
export async function fetchMarketCategoryCards(
  admin: SupabaseClient,
  vendorProfileIds: readonly string[],
  categories: readonly string[],
  now: Date,
): Promise<FindCardRow[] | null> {
  const profileIds = [...new Set(vendorProfileIds)].filter(Boolean);
  const cats = [...new Set(categories)].filter(Boolean);
  if (profileIds.length === 0 || cats.length === 0) return [];
  try {
    const { data, error } = await admin
      .from('vendor_services')
      .select(`${BENCH_CARD_FIELDS},base_pax,added_pax_block,added_pax_price_php,created_at`)
      .in('vendor_profile_id', profileIds)
      .in('category', cats)
      .eq('is_active', true)
      .eq('is_linked_only', false)
      .order('created_at', { ascending: true });
    if (error) {
      console.error('[bench-service-cards] category: vendor_services read failed', error);
      return null;
    }
    const rows = (data ?? []) as unknown as CardRow[];
    const cards = await cardsForRows(admin, rows, now);
    const out: FindCardRow[] = [];
    for (const row of rows) {
      const card = cards.get(row.vendor_service_id);
      if (!card || !row.category) continue;
      out.push({
        serviceId: row.vendor_service_id,
        profileId: row.vendor_profile_id,
        service: row.category,
        card,
        fromPhp: card.priceText ? cheapestStartsAt([row], null).startsAtPhp : null,
      });
    }
    return out;
  } catch (err) {
    console.error('[bench-service-cards] category: read threw', err);
    return null;
  }
}

/**
 * One card per marketplace supplier inside a category, FROM the category's cards already read
 * (`fetchMarketCategoryCards`): profile id → their oldest card — the one a Save that names no card attaches
 * (`vendors/actions` takes the category's first active row). No read of its own. `null` in → `null` out.
 */
export function firstCardPerSupplier(cards: readonly FindCardRow[] | null): Record<string, BenchServiceCard> | null {
  if (!cards) return null;
  const out: Record<string, BenchServiceCard> = {};
  for (const c of cards) if (c.card && !(c.profileId in out)) out[c.profileId] = c.card;
  return out;
}
