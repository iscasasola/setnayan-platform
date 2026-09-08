import type { SupabaseClient } from '@supabase/supabase-js';

import type { VendorServiceRow } from '@/lib/vendor-services';

/**
 * marketplace-service-cards.ts — the marketplace lists SERVICES, not shops.
 *
 * ── WHY (owner, 2026-09-08) ────────────────────────────────────────────────
 * *"Marketplace is where they can view all services and search what they want …
 * so on the body, it will only show all service cards."* And, separately:
 * *"bench is the place where it is fixed per category."* Two surfaces, two
 * shapes — the marketplace is a flat list of everything, the bench is organised
 * per category inside an event.
 *
 * ── THE BUG THIS EXISTS TO KILL, MEASURED ─────────────────────────────────
 * `/explore` listed one card per VENDOR and picked a service to represent the
 * shop. On a shop with two cards, searching `category=host_mc` returned:
 *
 *     SHOWING: HOST MC
 *     "Live Band by Saysay Live Band & Hosting (FIXTURE)"
 *     Starts at ₱35,000
 *
 * The ₱40,000 Host Mc card appeared NOWHERE on the page. The vendor matched
 * correctly — they do offer host_mc — and then the page drew the wrong card. A
 * couple searching for a host was shown a band, at the band's price.
 *
 * 🔑 ONE ROW PER CARD MAKES THAT UNREPRESENTABLE. There is no "which of this
 * shop's services stands for the shop" question left to answer wrongly.
 *
 * ── WHAT IS DELIBERATELY NOT HERE ─────────────────────────────────────────
 * No category *grouping*. The marketplace is flat by owner ruling; `category`
 * is a FILTER a visitor may choose, never a spine the page is built on.
 */

/** One service card on the marketplace, with the shop it belongs to. */
export type MarketplaceServiceCard = {
  row: VendorServiceRow;
  vendorProfileId: string;
  businessName: string;
  businessSlug: string | null;
  locationCity: string | null;
};

export type MarketplaceQuery = {
  /** Free text across the service title and the shop name. */
  q?: string | null;
  /** One taxonomy kind (tile id, category or coverage leaf) — a filter, not a spine. */
  category?: string | null;
  /** Page size. The marketplace is browsable, so this is a window, not a cap. */
  limit?: number;
  offset?: number;
};

const SERVICE_COLS =
  'vendor_service_id,public_id,vendor_profile_id,category,title,starting_price_php,' +
  'added_pax_price_php,crew_size,crew_meal_required,is_active,created_at,updated_at,' +
  'pricing_basis,per_pax_price_php,min_pax,hour_base_php,min_hours,extra_hour_php,' +
  'crew_meal_included,transport_included,transport_flat_fee_php,showcase_video_r2_key,' +
  'showcase_photo_r2_keys,primary_photo_r2_key,branch_id,recommended_lead_time_months,' +
  'last_minute_end_months,last_minute_surcharge_pct,daily_capacity,exclusive_perk_text,' +
  'base_pax,coverage_id';

/**
 * Escape a value for a PostgREST `or=(…)` filter.
 *
 * ⚠ NOT decoration. `or()` takes a comma-separated expression list and commas
 * INSIDE a value split it into new conditions — so a shop searching for
 * "band, host" would silently become two filters, and a `)` would end the group
 * early. Anything that reaches this is visitor input from a query string.
 */
function safeForOr(value: string): string {
  return value.replace(/[,()*\\]/g, ' ').trim();
}

/**
 * Every service card a stranger may see, newest first.
 *
 * The visibility rule mirrors the `vendor_services_public_read` policy exactly —
 * active card, and a shop whose `verification_state` AND `public_visibility` are
 * both `verified` — rather than trusting RLS alone, because this runs with
 * whatever client the caller passes and an admin client bypasses the policy
 * entirely. Stating the rule here means the answer does not change with the
 * caller.
 *
 * ⛔ `is_published` IS NOT PART OF IT, and the first draft of this function got
 * that wrong. It is a dead column: its only writer in the whole app is a
 * tick-box on `/admin/vendors/[id]/edit`, and approving a shop does not set it —
 * the owner's own fully-verified shop sat at `is_published = false`. Seven code
 * paths were once gated on it and all seven silently found nothing, because a
 * dead gate and a genuinely empty result are the same value.
 * `lib/one-definition-of-live.test.ts` is what caught this one, before it
 * shipped.
 */
export async function fetchMarketplaceServiceCards(
  supabase: SupabaseClient,
  query: MarketplaceQuery = {},
): Promise<MarketplaceServiceCard[]> {
  const limit = Math.min(Math.max(query.limit ?? 48, 1), 200);
  const offset = Math.max(query.offset ?? 0, 0);

  let q = supabase
    .from('vendor_services')
    .select(
      `${SERVICE_COLS},vendor_profiles!inner(vendor_profile_id,business_name,business_slug,location_city,is_published,verification_state,public_visibility)`,
    )
    .eq('is_active', true)
    .eq('vendor_profiles.verification_state', 'verified')
    .eq('vendor_profiles.public_visibility', 'verified');

  if (query.category) q = q.eq('category', query.category);

  const text = query.q ? safeForOr(query.q) : '';
  if (text) {
    // Title OR shop name. A card with no title still matches on its shop, which
    // is the common case for a card the vendor never renamed.
    q = q.or(`title.ilike.%${text}%,vendor_profiles.business_name.ilike.%${text}%`);
  }

  const { data, error } = await q
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    // 🔑 THROW, do not return []. An empty array here renders as "no suppliers
    // match", which is the same picture a genuinely empty marketplace draws —
    // the failure mode this codebase keeps producing. The caller decides how to
    // show a broken search; it must not be handed a convincing lie.
    throw new Error(`fetchMarketplaceServiceCards failed: ${error.message}`);
  }

  return (data ?? []).map((r) => {
    const rec = r as Record<string, unknown>;
    const vp = (rec.vendor_profiles ?? {}) as Record<string, unknown>;
    const { vendor_profiles: _ignored, ...service } = rec;
    return {
      row: service as unknown as VendorServiceRow,
      vendorProfileId: String(vp.vendor_profile_id ?? ''),
      businessName: String(vp.business_name ?? ''),
      businessSlug: (vp.business_slug as string | null) ?? null,
      locationCity: (vp.location_city as string | null) ?? null,
    };
  });
}
