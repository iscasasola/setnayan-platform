import 'server-only';
/**
 * supplier-landing-data.ts — reads the service cards the /suppliers pages are
 * built from, and reduces each to a `LandingCard` (the pure rules live in
 * `supplier-landing.ts`).
 *
 * WHAT COUNTS, each rule derived from the one place it is already defined:
 *   · the card is active and not a demo row (`vendor_services.is_demo`);
 *   · its shop is LIVE by `isShopLive` — never a re-typed visibility check —
 *     and is not a demo shop;
 *   · its category files under a tile the marketplace shows (`marketplaceHidden`,
 *     `hiddenCategories`, `ADMIN_ONLY_TILES` all exclude);
 *   · its EVENT TYPES are its own coverage's, else its shop's, else wedding —
 *     the same precedence `vendor_coverages.event_types` documents;
 *   · its PRICE is withheld when the shop hides prices publicly
 *     (`fetchVendorsHidingPricesPublicly`, fail-open to showing, as everywhere).
 *
 * 🔑 THROWS on a failed read. A caller that caught it and rendered "0 suppliers"
 * would publish a convincing lie to a search engine; the page instead fails and
 * Next serves its error, which is not indexed.
 *
 * ⏭ SCALE: every page reads every live card (one query, paged at 1,000). That
 * is cheap while the marketplace is small and wrong once it is large — at that
 * point cache `loadLandingCards` behind `unstable_cache` (keyed on nothing,
 * revalidated hourly like the sitemaps). Named here so it is a decision, not a
 * surprise.
 */
import { cache } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createAdminClient } from '@/lib/supabase/admin';
import { getTaxonomy } from '@/lib/taxonomy-db';
import type { TaxonomySnapshot } from '@/lib/taxonomy-db';
import { ADMIN_ONLY_TILES, type WeddingTile } from '@/lib/taxonomy';
import { VENDOR_CATEGORIES, type VendorCategory } from '@/lib/vendors';
import { primaryTileForVendorCategory } from '@/lib/vendor-category-taxonomy';
import { isShopLive, PUBLIC_SURFACE_VISIBILITIES, SHOP_LIVE_COLUMNS } from '@/lib/vendor-visibility';
import { fetchVendorsHidingPricesPublicly } from '@/lib/vendor-service-attributes';
import { getEventTypeVocab } from '@/lib/event-types-db';
import type { MarketplaceServiceCard } from '@/lib/marketplace-service-cards';
import type { VendorServiceRow } from '@/lib/vendor-services';
import { cityKeyFor, type LandingCard, type PricingBasis } from '@/lib/supplier-landing';

/** The columns the card face needs — the marketplace loader's own list. */
const SERVICE_COLS =
  'vendor_service_id,public_id,vendor_profile_id,category,title,starting_price_php,' +
  'added_pax_price_php,crew_size,crew_meal_required,is_active,created_at,updated_at,' +
  'pricing_basis,per_pax_price_php,min_pax,hour_base_php,min_hours,extra_hour_php,' +
  'crew_meal_included,transport_included,transport_flat_fee_php,showcase_video_r2_key,' +
  'showcase_photo_r2_keys,primary_photo_r2_key,branch_id,recommended_lead_time_months,' +
  'last_minute_end_months,last_minute_surcharge_pct,daily_capacity,exclusive_perk_text,' +
  'base_pax,coverage_id,includes_setnayan_gift,is_demo';

const SHOP_COLS = `vendor_profile_id,business_name,business_slug,location_city,logo_url,event_types,is_demo,${SHOP_LIVE_COLUMNS}`;

const PAGE = 1000;

export type LandingSource = {
  /** Reduced cards, for the pure rules. Same order as `faces`. */
  cards: LandingCard[];
  /** The full rows, for drawing each card with the shared card face. */
  faces: MarketplaceServiceCard[];
  taxonomy: TaxonomySnapshot;
  /** Event-type key → label, from the live vocabulary. */
  eventLabel: Map<string, string>;
  /** True when the taxonomy says a tile applies to an event type. */
  tileServesEvent: (tile: string, event: string) => boolean;
};

function tileForCategory(category: string, taxonomy: TaxonomySnapshot): string | null {
  const entry = taxonomy.map[category];
  if (entry) return entry.marketplaceHidden ? null : (entry.tile ?? null);
  if ((VENDOR_CATEGORIES as readonly string[]).includes(category)) {
    return primaryTileForVendorCategory(category as VendorCategory);
  }
  return null;
}

function priceFor(row: Record<string, unknown>, basis: PricingBasis): number | null {
  const pick =
    basis === 'per_pax' ? row.per_pax_price_php : basis === 'per_hour' ? row.hour_base_php : row.starting_price_php;
  const n = typeof pick === 'number' ? pick : Number(pick);
  return Number.isFinite(n) && n > 0 ? n : null;
}

async function readAll(admin: SupabaseClient): Promise<Array<Record<string, unknown>>> {
  const out: Array<Record<string, unknown>> = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await admin
      .from('vendor_services')
      .select(`${SERVICE_COLS},vendor_profiles!inner(${SHOP_COLS})`)
      .eq('is_active', true)
      .in('vendor_profiles.public_visibility', PUBLIC_SURFACE_VISIBILITIES as string[])
      .order('created_at', { ascending: false })
      .range(from, from + PAGE - 1);
    if (error) throw new Error(`supplier landing: service cards read failed: ${error.message}`);
    out.push(...((data ?? []) as unknown as Array<Record<string, unknown>>));
    if (!data || data.length < PAGE) return out;
  }
}

export const loadLandingCards = cache(async (): Promise<LandingSource> => {
  const admin = createAdminClient();
  const [rows, taxonomy, vocab] = await Promise.all([readAll(admin), getTaxonomy(), getEventTypeVocab()]);

  // Live shops only (the one predicate), and never a demo card or demo shop.
  const live = rows.filter((r) => {
    const shop = (r.vendor_profiles ?? {}) as Record<string, unknown>;
    return isShopLive(shop) && shop.is_demo !== true && r.is_demo !== true;
  });

  const coverageIds = [
    ...new Set(live.map((r) => r.coverage_id).filter((id): id is number => typeof id === 'number')),
  ];
  const shopIds = [...new Set(live.map((r) => String(r.vendor_profile_id)))];

  const [coverageRes, hiding] = await Promise.all([
    coverageIds.length
      ? admin.from('vendor_coverages').select('id,event_types').in('id', coverageIds)
      : Promise.resolve({ data: [], error: null }),
    fetchVendorsHidingPricesPublicly(admin, shopIds),
  ]);
  if (coverageRes.error) throw new Error(`supplier landing: coverages read failed: ${coverageRes.error.message}`);
  const coverageEvents = new Map<number, string[]>();
  for (const c of (coverageRes.data ?? []) as Array<{ id: number; event_types: string[] | null }>) {
    if (c.event_types && c.event_types.length) coverageEvents.set(c.id, c.event_types);
  }

  const cards: LandingCard[] = [];
  const faces: MarketplaceServiceCard[] = [];
  for (const r of live) {
    const category = String(r.category ?? '');
    const tile = tileForCategory(category, taxonomy);
    if (tile && (ADMIN_ONLY_TILES.has(tile as WeddingTile) || taxonomy.hiddenCategories[tile])) continue;

    const shop = (r.vendor_profiles ?? {}) as Record<string, unknown>;
    const shopEvents = Array.isArray(shop.event_types) ? (shop.event_types as string[]) : [];
    const eventTypes =
      (typeof r.coverage_id === 'number' ? coverageEvents.get(r.coverage_id) : undefined) ??
      (shopEvents.length ? shopEvents : ['wedding']);
    const basis = (['fixed', 'per_pax', 'per_hour'] as const).includes(r.pricing_basis as PricingBasis)
      ? (r.pricing_basis as PricingBasis)
      : 'fixed';
    const shopId = String(r.vendor_profile_id);

    cards.push({
      serviceId: String(r.vendor_service_id),
      shopId,
      tile,
      eventTypes,
      cityKey: cityKeyFor(shop.location_city as string | null),
      pricingBasis: basis,
      pricePhp: hiding.has(shopId) ? null : priceFor(r, basis),
    });
    const { vendor_profiles: _shop, ...service } = r;
    faces.push({
      row: service as unknown as VendorServiceRow,
      vendorProfileId: shopId,
      businessName: String(shop.business_name ?? ''),
      businessSlug: (shop.business_slug as string | null) ?? null,
      locationCity: (shop.location_city as string | null) ?? null,
      businessLogoRef: (shop.logo_url as string | null) ?? null,
    });
  }

  const eventLabel = new Map(vocab.map((t) => [t.key, t.label]));
  const tileServesEvent = (tile: string, event: string) => {
    const allowed = taxonomy.tileEventTypes[tile];
    return allowed == null || allowed.includes(event);
  };
  return { cards, faces, taxonomy, eventLabel, tileServesEvent };
});
