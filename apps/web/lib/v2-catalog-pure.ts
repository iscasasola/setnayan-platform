/**
 * lib/v2-catalog-pure.ts — the catalog ROW SHAPES and the price ARITHMETIC that
 * turns one into a label, with no database in the module graph.
 *
 * Split out of lib/v2-catalog.ts, which reads
 * `platform_retail_catalog_v2` through the service-role client. The onboarding
 * price copy (`app/onboarding/wedding/_components/onboarding-pricing.ts`)
 * formats labels from rows it was HANDED, and it is reached — via
 * `lib/onboarding/persona-packs.ts` — from `generic-onboarding.tsx`
 * ('use client').
 *
 * 🔑 FORMATTING A PRICE IS NOT READING ONE. `computePaxPriceCentavos` is the
 * authoritative pax curve and it is pure over its argument: the SKU row is the
 * input, not something this file fetches. The server still decides which row a
 * caller gets (and `resolvePaxPricedOrderCentavos` in the sibling still
 * re-derives the charge server-side, so a client can neither pick its own row
 * nor its own price).
 *
 * Server callers keep importing from `@/lib/v2-catalog`, which re-exports
 * everything here.
 */

/**
 * Catalog price recurrence (migration 20270322883953). `one_time` = a single
 * charge (every SKU but SETNAYAN_AI today · renders with NO period suffix,
 * byte-identical to the pre-subscription path). `per_28d` = the price is per
 * 28-day cycle (SETNAYAN_AI ₱499/28d · owner 2026-06-29) · renders "₱X / 28
 * days", matching the vendor 28-day billing cadence. Both the number AND the
 * unit come from the catalog row — never hardcoded.
 */
export type BillingPeriod = 'one_time' | 'per_28d' | 'per_day' | 'per_year';

export type V2CustomerSku = {
  service_code: string;
  title: string;
  retail_price_php: number;     // in pesos (NUMERIC from DB · already in PHP)
  /**
   * The SIGN-UP price — what this service costs if you take it while creating
   * your event, versus `retail_price_php` afterwards (owner 2026-08-12).
   *
   * ⚠ NULLABLE, AND NULL MEANS "NO SIGN-UP DISCOUNT ON THIS SERVICE" — most rows
   * have none. It does NOT mean free. Reading it as 0 would hand the product
   * away, which is why every consumer falls back to the regular price and never
   * to zero; `lib/setnayan-ai-event-pricing.ts` already states that rule for the
   * checkout path and this is the same column.
   *
   * 🔑 IT WAS ALREADY IN THE DATABASE AND ALREADY CHARGED — it was just invisible
   * to every PUBLIC surface, because this select did not ask for it. Setnayan AI
   * has carried two prices since 2026-08-12 and `/pricing` showed one.
   */
  onboarding_price_php: number | null;
  saas_overhead_cost_php: number;
  is_token_able: boolean;
  description: string | null;
  build_status: BuildStatus;
  // Recurrence — migration 20270322883953. Drives the "/ 28 days" suffix in
  // formatSkuPriceLabel; defaults to 'one_time' for every existing SKU.
  billing_period: BillingPeriod;
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
  // `branch` / `seat` / `custom_addon` / `vendor_addon_recurring` extend the
  // union as the vendor add-on ladder grew (extra branch #20270128654206 ·
  // extra seat #20270511762904 · Custom-tier composition SKUs #20270512705572 ·
  // Vendor AI add-on #20270905761946). fetchV2VendorCatalog reads EVERY active
  // row (no offering_type filter), so all of these flow through.
  offering_type:
    | 'subscription_monthly'
    | 'subscription_annual'
    | 'token_pack'
    | 'branch'
    | 'seat'
    | 'custom_addon'
    | 'vendor_addon_recurring';
  token_grant_count: number | null;
  max_categories: number | null;
  max_sub_seats: number | null;
  display_order: number;
};

export type BuildStatus = 'live' | 'partial' | 'not_built';

/**
 * The couple-facing period suffix for a recurring SKU. Verbose "/ 28 days"
 * matches the vendor pricing house style (`/vendors` renders "/ 28 days"
 * for the prepaid-block subs). `one_time` renders NOTHING, so flat SKUs are
 * byte-identical to the pre-subscription path. The suffix is data-driven off
 * the catalog `billing_period`, never hardcoded per surface.
 */
const BILLING_PERIOD_SUFFIX: Record<BillingPeriod, string> = {
  one_time: '',
  per_28d: ' / 28 days',
  // Per event-day charge (Patiktok ₱1,499/day) — same event-day model as Panood;
  // the amount is flat per purchase, the couple activates it per day.
  per_day: ' / day',
  // Annual prepaid block (Custom Subdomain ₱999/year · owner 2026-07-10) — manual
  // renewal reminder before expiry, no auto-charge (mirrors the vendor prepaid blocks).
  per_year: ' / year',
};

/**
 * Period suffix for a catalog row, e.g. "" (one-time) or " / 28 days"
 * (per-28-day subscription). Append to a formatted "₱X" so the unit always
 * travels with the number.
 */
export function formatBillingPeriodSuffix(
  billingPeriod: BillingPeriod | null | undefined,
): string {
  return BILLING_PERIOD_SUFFIX[billingPeriod ?? 'one_time'] ?? '';
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
> &
  // Optional so callers that only have the pax subset still type-check; absent
  // → treated as one_time → no suffix (the pre-subscription behaviour).
  Partial<Pick<V2CustomerSku, 'billing_period'>>;

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
 *   • Pax-priced SKU + NO event context (e.g. /pricing, vendors catalog)
 *     → "from ₱X" off the floor (the price genuinely starts there + rises with
 *     guests · honest, not the old bare "₱2,999").
 *   • Pax-priced SKU + a known event pax → the exact "₱X" for that wedding.
 *   • Flat SKU → "₱X".
 *   • per_28d SKU (SETNAYAN_AI) → the price + " / 28 days" suffix so ₱499 never
 *     reads as a one-time fire-sale. The suffix is data-driven off the catalog
 *     billing_period — one-time SKUs keep rendering exactly as before.
 */
export function formatSkuPriceLabel(
  sku: PaxPricingConfig,
  pax?: number | null,
): string {
  const suffix = formatBillingPeriodSuffix(sku.billing_period);
  if (sku.is_pax_priced && (pax === undefined || pax === null)) {
    return `from ₱${formatPeso(sku.retail_price_php)}${suffix}`;
  }
  const centavos = computePaxPriceCentavos(sku, pax ?? null);
  return `₱${formatPeso(centavos / 100)}${suffix}`;
}
