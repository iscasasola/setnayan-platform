/**
 * V2 catalog reader · single source of truth for the live pricing surfaces.
 *
 * Reads from the 3 V2 catalog tables in setnayan-prod and exposes typed
 * shapes to server components. Replaces the V1 sku-catalog.ts TypeScript
 * mirror (which carries retired SKUs and 5% Setnayan Pay language).
 *
 * Tables:
 *   platform_retail_catalog_v2  · 19 customer SKUs
 *   platform_package_catalog    · 2 bundles (Guided Pack + Media Pack)
 *   vendor_billing_catalog      · 7 vendor SKUs (2 subs + 5 token packs)
 *
 * Build status is hardcoded here (not in DB) so we can be honest about
 * what works vs what's coming. Items marked NOT_BUILT render with a
 * "Coming soon" badge instead of a buy button. Aligned to the audit
 * shared with owner 2026-05-28.
 *
 * Per owner directive: Setnayan takes ZERO commission · vendor bookings
 * are transacted off-platform · customers buy software SKUs at 100%
 * retail directly from Setnayan as publisher.
 */

import { createAdminClient } from '@/lib/supabase/admin';

export type V2CustomerSku = {
  service_code: string;
  title: string;
  retail_price_php: number;     // in pesos (NUMERIC from DB · already in PHP)
  saas_overhead_cost_php: number;
  is_token_able: boolean;
  description: string | null;
  build_status: BuildStatus;
  // Pax-based pricing — migration 20260720000000 · owner-locked 2026-06-02.
  // is_pax_priced=false → retail_price_php is the flat charge (every SKU but
  // PAPIC_GUEST today · byte-identical to the pre-pax path). When true, the
  // four pax_* fields drive computePaxPriceCentavos() keyed to
  // events.estimated_pax (floor ₱2,999 @ 100 pax · +₱350 / 50 for PAPIC_GUEST).
  is_pax_priced: boolean;
  pax_floor: number | null;
  pax_floor_price_php: number | null;
  pax_increment_size: number | null;
  pax_increment_price_php: number | null;
};

export type V2BundleSku = {
  package_code: string;
  title: string;
  retail_price_php: number;
};

export type V2VendorSku = {
  sku_code: string;
  title: string;
  price_php: number;
  // `subscription_annual` added 2026-05-29 alongside the eleventh 2026-05-28
  // amendment: Pro Vendor ₱19,999/yr + Enterprise Vendor ₱54,999/yr ·
  // ~17% off vs monthly × 12 · charm-priced -1 endings · same per-tier
  // capability shape as monthly equivalents (max_categories + max_sub_seats
  // identical) · only price + billing cadence differ.
  offering_type: 'subscription_monthly' | 'subscription_annual' | 'token_pack';
  token_grant_count: number | null;
  max_categories: number | null;
  max_sub_seats: number | null;
  display_order: number;
};

export type BuildStatus = 'live' | 'partial' | 'not_built';

/**
 * Hardcoded build status per SKU. Honest about what's actually wired
 * end-to-end vs catalog-only-with-no-fulfillment. Update as features
 * ship.
 *
 * Source: feature audit shared with owner 2026-05-28.
 */
const BUILD_STATUS: Record<string, BuildStatus> = {
  // Live and working today
  // (TODAYS_FOCUS removed 2026-06-05 — the AI-planner SKU is retired; the
  //  reader also filters its catalog row out via `.neq('service_code', …)`.)
  PRO_WEBSITE:         'partial',  // = Editorial Website (post-event phase) · free baseline live · Pro gating not built
  // Wedding-website lifecycle phases (owner 2026-06-08 · added to catalog DB):
  // RSVP (before) · Event Website (during) · Editorial = PRO_WEBSITE (after).
  // Same in-build state as the Editorial phase — baseline live, upgrades not built.
  RSVP_WEBSITE:        'partial',  // RSVP phase ₱2,499
  RSVP_PRO_WEBSITE:    'partial',  // RSVP Pro upgrade ₱4,499
  EVENT_WEBSITE:       'partial',  // during-event website ₱1,500
  CUSTOM_QR_GUEST:     'live',     // branded per-guest QR (monogram + palette + print) · PR #727 · 2026-06-01
  INDOOR_BLUEPRINT:    'live',     // entrance→table wayfinding end-to-end: couple studio + guest find-my-table · migration 20260717000000 · 2026-06-02

  // Partially working
  ANIMATED_MONOGRAM:   'live',     // drawn-live monogram bound to the SKU · PR #729 · 2026-06-01
  PANOOD_SYSTEM:       'partial',  // OAuth + UI shipped · pending YouTube verified-app
  PATIKTOK_COMPILER:   'partial',  // booth scaffold · TikTok app review pending
  PAPIC_GUEST:         'live',     // guest camera end-to-end: cookie identity + server quota (150) + capture · 2026-06-02
  PAPIC_SEATS:         'live',     // photo crew end-to-end: provision + claim + capture · PR #731 + migration 20260718000000 · 2026-06-01
  HIGH_RES_ARCHIVE:    'partial',  // 0009 photo delivery partial
  LIVE_BACKGROUND:     'partial',  // 0005 Pailaw engineering brief · code not verified

  // Not built · catalog-only · no fulfillment yet
  PABATI:                'not_built',
  PAKANTA:               'not_built',
  PAPIC_ADDON_STORIES:   'not_built',
  PAPIC_ADDON_THANK_YOU: 'not_built',
  SDE:                   'not_built',  // AI edit pipeline not built
  CAMERA_BRIDGE:         'not_built',  // needs native iOS/Android + DSLR SDK
  LIVE_WALL:             'not_built',  // WebSocket display surface not built
  CALL_TIME_ESCALATOR:   'not_built',  // no SMS infrastructure
};

/**
 * Server-side fetch of all customer SKUs from the V2 catalog.
 * Sorted by display priority · token-worthy items first.
 */
export async function fetchV2CustomerCatalog(): Promise<V2CustomerSku[]> {
  // createAdminClient throws when SUPABASE_SERVICE_ROLE_KEY is unset (CI
  // builds run `next build` with placeholder NEXT_PUBLIC_* env only · no
  // service-role key). Match the documented "return [] on error" semantic
  // below so callers degrade gracefully — the page renders an empty
  // catalog instead of failing the prerender. Defense-in-depth alongside
  // `export const dynamic = 'force-dynamic'` in /pricing/page.tsx.
  // CLAUDE.md 2026-05-28 row "fix endless loop error on vercel".
  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return [];
  }
  const { data, error } = await admin
    .from('platform_retail_catalog_v2')
    .select('service_code, title, retail_price_php, saas_overhead_cost_php, is_token_able, description, is_pax_priced, pax_floor, pax_floor_price_php, pax_increment_size, pax_increment_price_php')
    // Today's Focus REMOVED COMPLETELY (owner 2026-06-05) — the retired AI
    // planner SKU must not surface on /pricing, /for-vendors, or the admin
    // discount picker (the three consumers of this reader). Excluded here so it
    // drops everywhere without a DB write (the row stays in the table, just
    // unsurfaced). See DECISION_LOG 2026-06-05.
    .neq('service_code', 'TODAYS_FOCUS')
    .order('service_code', { ascending: true });

  if (error || !data) return [];

  return data.map((row) => ({
    service_code: row.service_code as string,
    title: row.title as string,
    retail_price_php: Number(row.retail_price_php),
    saas_overhead_cost_php: Number(row.saas_overhead_cost_php),
    is_token_able: Boolean(row.is_token_able),
    description: (row.description as string | null) ?? null,
    build_status: BUILD_STATUS[row.service_code as string] ?? 'not_built',
    is_pax_priced: Boolean(row.is_pax_priced),
    pax_floor: row.pax_floor == null ? null : Number(row.pax_floor),
    pax_floor_price_php:
      row.pax_floor_price_php == null ? null : Number(row.pax_floor_price_php),
    pax_increment_size:
      row.pax_increment_size == null ? null : Number(row.pax_increment_size),
    pax_increment_price_php:
      row.pax_increment_price_php == null ? null : Number(row.pax_increment_price_php),
  }));
}

export async function fetchV2BundleCatalog(): Promise<V2BundleSku[]> {
  // Same build-time tolerance as fetchV2CustomerCatalog above — see WHY there.
  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return [];
  }
  const { data, error } = await admin
    .from('platform_package_catalog')
    .select('package_code, title, retail_price_php')
    .order('retail_price_php', { ascending: true });

  if (error || !data) return [];

  return data.map((row) => ({
    package_code: row.package_code as string,
    title: row.title as string,
    retail_price_php: Number(row.retail_price_php),
  }));
}

export async function fetchV2VendorCatalog(): Promise<V2VendorSku[]> {
  // Same build-time tolerance as fetchV2CustomerCatalog above — see WHY there.
  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return [];
  }
  const { data, error } = await admin
    .from('vendor_billing_catalog')
    .select('sku_code, title, price_php, offering_type, token_grant_count, max_categories, max_sub_seats, display_order')
    .eq('is_active', true)
    .order('display_order', { ascending: true });

  if (error || !data) return [];

  return data.map((row) => ({
    sku_code: row.sku_code as string,
    title: row.title as string,
    price_php: Number(row.price_php),
    offering_type: row.offering_type as 'subscription_monthly' | 'subscription_annual' | 'token_pack',
    token_grant_count: (row.token_grant_count as number | null) ?? null,
    max_categories: (row.max_categories as number | null) ?? null,
    max_sub_seats: (row.max_sub_seats as number | null) ?? null,
    display_order: Number(row.display_order ?? 0),
  }));
}

/**
 * Format a peso amount with thousand separators · no decimals if whole.
 */
export function formatPeso(amount: number): string {
  if (Number.isInteger(amount)) {
    return amount.toLocaleString('en-PH');
  }
  return amount.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export const BUILD_STATUS_LABEL: Record<BuildStatus, string> = {
  live: 'Live',
  partial: 'Partial · in active build',
  not_built: 'Coming soon',
};

// ─────────────────────────────────────────────────────────────────────────
// Pax-based pricing engine · owner-locked 2026-06-02 (CLAUDE.md "📸 Papic
// Guest pax-curve increment LOCKED at ₱350/50"). Backed by the pax_* columns
// on platform_retail_catalog_v2 (migration 20260720000000). First + only
// pax-priced SKU today: PAPIC_GUEST (floor ₱2,999 @ 100 pax · +₱350 / 50).
// Every other SKU is is_pax_priced=FALSE → these helpers return the flat
// retail price, byte-identical to the pre-pax path.
// ─────────────────────────────────────────────────────────────────────────

/** The pax-config subset needed to price a row. */
export type PaxPricingConfig = Pick<
  V2CustomerSku,
  | 'retail_price_php'
  | 'is_pax_priced'
  | 'pax_floor'
  | 'pax_floor_price_php'
  | 'pax_increment_size'
  | 'pax_increment_price_php'
>;

/**
 * Authoritative price for a customer SKU at a given guest count, in CENTAVOS
 * (integer · the charge unit · matches submitOrderAction's BigInt(original_centavos)).
 *
 * Flat SKUs (is_pax_priced=false · everything but PAPIC_GUEST today) — or any
 * row with an incomplete pax config (the DB CHECK prevents this, but never
 * trust a half-config at runtime) — return retail_price_php × 100.
 *
 * Pax-priced SKUs scale per the locked model:
 *   floor_price + increment_price × ceil(max(0, pax − floor) / block)
 * Guests at/below the floor — or an unknown (null) pax — charge the floor
 * price (the "nothing prices below the floor" rule). Couples between two
 * increments round UP to the next block (the SKU covers *up to* that count).
 *
 * PAPIC_GUEST verification (floor 100 @ ₱2,999 · block 50 · +₱350):
 *   100→299900 · 150→334900 · 200→369900 · 250→404900 · 300→439900 · 500→579900
 */
export function computePaxPriceCentavos(
  sku: PaxPricingConfig,
  pax: number | null | undefined,
): number {
  if (
    !sku.is_pax_priced ||
    sku.pax_floor == null ||
    sku.pax_floor_price_php == null ||
    sku.pax_increment_size == null ||
    sku.pax_increment_size <= 0 ||
    sku.pax_increment_price_php == null
  ) {
    return Math.round(sku.retail_price_php * 100);
  }

  const guests =
    typeof pax === 'number' && Number.isFinite(pax) ? pax : sku.pax_floor;
  const above = Math.max(0, guests - sku.pax_floor);
  const blocks = Math.ceil(above / sku.pax_increment_size);
  const pesos = sku.pax_floor_price_php + blocks * sku.pax_increment_price_php;
  return Math.round(pesos * 100);
}

/**
 * Human price label for a customer SKU.
 *   • Pax-priced SKU + NO event context (e.g. /pricing, for-vendors catalog)
 *     → "from ₱X" off the floor (the price genuinely starts there + rises with
 *     guests · honest, not the old bare "₱2,999").
 *   • Pax-priced SKU + a known event pax → the exact "₱X" for that wedding.
 *   • Flat SKU → "₱X".
 */
export function formatSkuPriceLabel(
  sku: PaxPricingConfig,
  pax?: number | null,
): string {
  if (sku.is_pax_priced && (pax === undefined || pax === null)) {
    return `from ₱${formatPeso(sku.retail_price_php)}`;
  }
  const centavos = computePaxPriceCentavos(sku, pax ?? null);
  return `₱${formatPeso(centavos / 100)}`;
}

/**
 * Server-side AUTHORITATIVE price for an order line, in centavos — the keystone
 * for tamper-proof pax pricing. submitOrderAction calls this; when the SKU is
 * pax-priced it recomputes the charge from events.estimated_pax + the catalog
 * config, IGNORING the client-supplied original_centavos (defence-in-depth ·
 * mirrors the voucher re-validation in the same action).
 *
 * Returns:
 *   • { is_pax_priced: true,  centavos } — caller MUST override the price.
 *   • { is_pax_priced: false, centavos } — caller keeps trusting the client
 *     (every flat V2-customer SKU · byte-identical charge path preserved).
 *   • null — SKU not in platform_retail_catalog_v2 (vendor / bundle / legacy
 *     SKUs) OR any DB error → caller falls back to the client price, so a
 *     transient read failure NEVER blocks an order.
 *
 * Uses the admin client for both reads (catalog is admin-read; the event is the
 * couple's own — we compute THEIR price). Graceful-degrades to the floor (pax
 * null) if estimated_pax is missing / the column is absent in a stale env.
 */
export async function resolvePaxPricedOrderCentavos(
  eventId: string,
  serviceCode: string,
): Promise<{ is_pax_priced: boolean; centavos: number } | null> {
  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return null;
  }

  const { data: sku, error: skuErr } = await admin
    .from('platform_retail_catalog_v2')
    .select(
      'retail_price_php, is_pax_priced, pax_floor, pax_floor_price_php, pax_increment_size, pax_increment_price_php',
    )
    .eq('service_code', serviceCode)
    .maybeSingle();

  if (skuErr || !sku) return null;

  const config: PaxPricingConfig = {
    retail_price_php: Number(sku.retail_price_php),
    is_pax_priced: Boolean(sku.is_pax_priced),
    pax_floor: sku.pax_floor == null ? null : Number(sku.pax_floor),
    pax_floor_price_php:
      sku.pax_floor_price_php == null ? null : Number(sku.pax_floor_price_php),
    pax_increment_size:
      sku.pax_increment_size == null ? null : Number(sku.pax_increment_size),
    pax_increment_price_php:
      sku.pax_increment_price_php == null
        ? null
        : Number(sku.pax_increment_price_php),
  };

  let pax: number | null = null;
  if (config.is_pax_priced) {
    const { data: event } = await admin
      .from('events')
      .select('estimated_pax')
      .eq('event_id', eventId)
      .maybeSingle();
    pax =
      event && event.estimated_pax != null ? Number(event.estimated_pax) : null;
  }

  return {
    is_pax_priced: config.is_pax_priced,
    centavos: computePaxPriceCentavos(config, pax),
  };
}
