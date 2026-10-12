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
 *   · `fetchMarketServiceCards`  — one card per marketplace supplier inside a
 *     category, for the "More to compare" list under a row.
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

type CardRow = {
  vendor_service_id: string;
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
};

/** What the bench card prints from a service card — nothing else is read. */
const BENCH_CARD_FIELDS =
  'vendor_service_id,vendor_profile_id,title,category,pricing_basis,starting_price_php,' +
  'per_pax_price_php,min_pax,hour_base_php,min_hours,extra_hour_php,crew_meal_included,' +
  'transport_included,transport_flat_fee_php,exclusive_perk_text,includes_setnayan_gift,' +
  'primary_photo_r2_key';

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
  const [discounts, inclusions, brackets, hiding] = await Promise.all([
    fetchDiscountsByService(admin, ids),
    fetchInclusionsByService(admin, ids),
    fetchBracketsByService(admin, ids),
    fetchVendorsHidingPricesPublicly(admin, shopIds),
  ]);
  for (const row of rows) {
    out.set(
      row.vendor_service_id,
      benchServiceCard({
        service: row,
        discounts: discounts.get(row.vendor_service_id) ?? [],
        inclusions: inclusions.get(row.vendor_service_id) ?? [],
        brackets: brackets.get(row.vendor_service_id) ?? [],
        hidePrices: hiding.has(row.vendor_profile_id),
        coverUrl: publicUrlForStoredAsset(row.primary_photo_r2_key),
        now,
      }),
    );
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
 * One card per marketplace supplier inside a category: profile id → their
 * card for it. When a supplier has several active cards in the category the
 * OLDEST is shown — the one a Save from this list attaches (`vendors/actions`
 * takes the category's first active row). `null` = the read failed.
 */
export async function fetchMarketServiceCards(
  admin: SupabaseClient,
  vendorProfileIds: readonly string[],
  categories: readonly string[],
  now: Date,
): Promise<Record<string, BenchServiceCard> | null> {
  const profileIds = [...new Set(vendorProfileIds)].filter(Boolean);
  const cats = [...new Set(categories)].filter(Boolean);
  if (profileIds.length === 0 || cats.length === 0) return {};
  try {
    const { data, error } = await admin
      .from('vendor_services')
      .select(BENCH_CARD_FIELDS)
      .in('vendor_profile_id', profileIds)
      .in('category', cats)
      .eq('is_active', true)
      .order('created_at', { ascending: true });
    if (error) {
      console.error('[bench-service-cards] market: vendor_services read failed', error);
      return null;
    }
    const first = new Map<string, CardRow>();
    for (const row of (data ?? []) as unknown as CardRow[]) {
      if (!first.has(row.vendor_profile_id)) first.set(row.vendor_profile_id, row);
    }
    const cards = await cardsForRows(admin, [...first.values()], now);
    const out: Record<string, BenchServiceCard> = {};
    for (const [profileId, row] of first) {
      const card = cards.get(row.vendor_service_id);
      if (card) out[profileId] = card;
    }
    return out;
  } catch (err) {
    console.error('[bench-service-cards] market: read threw', err);
    return null;
  }
}
