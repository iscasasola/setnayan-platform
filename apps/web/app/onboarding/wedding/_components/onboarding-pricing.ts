/**
 * onboarding-pricing.ts — live-catalog → onboarding view-model.
 *
 * WHY (owner directive 2026-06-08): "our pricing must not be hardcoded but
 * taken from the admin pricing page." The onboarding services screens (15/16)
 * previously read SELLING prices from a hardcoded `SVC` constant in
 * onboarding-shell.tsx. They must instead read the SAME live, admin-managed
 * catalog that /pricing reads:
 *   - platform_retail_catalog_v2  (à-la-carte customer SKUs) · fetchV2CustomerCatalog()
 *   - platform_package_catalog    (the 2 bundles)            · fetchV2BundleCatalog()
 * Admins edit both at /admin/pricing.
 *
 * This module is a small, PURE, server-importable transform: it turns the two
 * live-catalog fetch results into ONE plain-serializable view-model the client
 * shell consumes across the server→client boundary (all fields are plain JSON —
 * numbers + strings + booleans). It carries NO 'use client' / NO 'server-only'
 * so the onboarding server page (page.tsx) can import + call it, then pass the
 * result as a prop.
 *
 * It is intentionally free of any picker/refine imports so the in-flight Dream
 * Team picker restructure never collides with this pricing wiring.
 *
 * Boundary:
 *   - svc[k].set   = Setnayan SELLING price (pesos) FROM the live catalog. The
 *                    customer-charged amount. For the pax SKU this is the floor
 *                    (₱2,999) used only for aggregate math fallbacks; the
 *                    authoritative charge is recomputed server-side at order
 *                    time by resolvePaxPricedOrderCentavos.
 *   - svc[k].label = display string via formatSkuPriceLabel ("from ₱2,999" for
 *                    PAPIC_GUEST, "₱X" for flat SKUs). What the UI renders.
 *   - svc[k].out   = ILLUSTRATIVE market anchor ("if hired elsewhere"). NOT a
 *                    Setnayan price, never customer-charged. No catalog/DB
 *                    column exists for it (no compare_at field on
 *                    platform_retail_catalog_v2), so it stays an author-curated
 *                    constant here (OUT_ANCHORS) — permitted by the directive.
 */
import {
  type V2CustomerSku,
  type V2BundleSku,
  type BuildStatus,
  formatSkuPriceLabel,
} from '@/lib/v2-catalog';

/**
 * The 14 onboarding in-app service keys → their platform_retail_catalog_v2
 * service_code. Single source of truth for the inapp-key ↔ catalog mapping.
 *
 * VERIFIED against live platform_retail_catalog_v2 (is_active=true, 2026-06-08).
 * NOTE the map is keyed by service_code (NOT title): PRO_WEBSITE's live title is
 * "Editorial Website" (₱7,999) and LIVE_WALL's is "Live Venue Photo Wall" — the
 * code match is exact regardless of display title. PAPIC_GUEST is the only
 * is_pax_priced=true row. `high_res` from BUNDLE_ITEMS is NOT an onboarding inapp
 * key (free baseline) and is intentionally absent.
 */
export const INAPP_TO_SERVICE_CODE: Record<string, string> = {
  papic_seats: 'PAPIC_SEATS',
  advanced_website: 'PRO_WEBSITE',
  animated_monogram: 'ANIMATED_MONOGRAM',
  panood: 'PANOOD_SYSTEM',
  papic_guest: 'PAPIC_GUEST',
  sde: 'SDE',
  pakanta: 'PAKANTA',
  custom_qr: 'CUSTOM_QR_GUEST',
  // indoor_blueprint RETIRED (owner 2026-06-08) — dropped from the catalog + the offered set.
  live_background: 'LIVE_BACKGROUND',
  pabati: 'PABATI',
  guest_stories: 'PAPIC_ADDON_STORIES',
  thank_you: 'PAPIC_ADDON_THANK_YOU',
  live_photowall: 'LIVE_WALL',
};

/**
 * Illustrative market anchors — what each service would cost if hired
 * SEPARATELY from other providers. NOT a Setnayan price; never customer-charged.
 * Setnayan's selling prices come from the live catalog (svc[k].set). These
 * power the "You save ₱X vs <vendor>" comparison lines only.
 *
 * Lifted verbatim from the old hardcoded SVC table's `out` values — there is no
 * catalog/DB column for a market-anchor / compare-at price, and the owner
 * directive explicitly permits keeping these as a clearly-labeled illustrative
 * constant.
 */
export const OUT_ANCHORS: Record<string, number> = {
  advanced_website: 25000,
  papic_guest: 32000,
  sde: 35000,
  guest_stories: 8000,
  pabati: 12000,
  papic_seats: 75000,
  animated_monogram: 15500,
  thank_you: 60000,
  pakanta: 12500,
  custom_qr: 5000,
  panood: 17500,
  live_background: 20000,
  live_photowall: 18000,
};

/**
 * Bundle membership — which à-la-carte services each package bundles. Used to
 * compute the bundle "worth" (Σ of member SELLING prices) and therefore the
 * displayed savings. There is NO DB/constant source for bundle membership
 * (verified: no platform_package_items table, no inclusions constant), so this
 * list is AUTHOR-CURATED.
 *
 * Owner-decided 2026-06-08: BUNDLES ARE ONBOARDING-ONLY (never sold outside the
 * flow), so membership is scoped to the onboarding in-app service set. `complete`
 * = every offered onboarding service; `essentials` = the curated value core.
 * `indoor_blueprint` removed (SKU retired 2026-06-08). Drives the displayed
 * "worth / save ₱X" on the onboarding bundle card.
 */
export const BUNDLE_MEMBERS: { essentials: string[]; complete: string[] } = {
  // Essentials — the curated value core.
  essentials: [
    'custom_qr',
    'animated_monogram',
    'advanced_website',
    'papic_seats',
  ],
  // Complete — every offered onboarding in-app service.
  complete: [
    'papic_seats',
    'advanced_website',
    'animated_monogram',
    'panood',
    'papic_guest',
    'sde',
    'pakanta',
    'custom_qr',
    'live_background',
    'pabati',
    'guest_stories',
    'thank_you',
    'live_photowall',
  ],
};

/** Per-service onboarding price view-model (one row per inapp key). */
export type OnboardingSvcPrice = {
  /** Setnayan selling price in pesos, from the live catalog. Pax SKU → floor. */
  set: number;
  /** Illustrative "if hired elsewhere" market anchor. NOT a Setnayan price. */
  out: number;
  /** Display string via formatSkuPriceLabel — "from ₱2,999" (pax) or "₱X". */
  label: string;
  /** True only for PAPIC_GUEST today. */
  isPax: boolean;
  /** Live build status from the catalog reader. */
  buildStatus: BuildStatus;
};

/** Bundle view-model. price+title from platform_package_catalog. */
export type OnboardingBundleVM = {
  code: string;
  title: string;
  price: number;
  /** Σ member SELLING prices (pesos). */
  worth: number;
  /** max(0, worth − price). */
  savings: number;
};

/** The full onboarding pricing view-model passed into OnboardingShell. */
export type OnboardingPricing = {
  /** Keyed by ONBOARDING inapp key (papic_seats…), NOT service_code. */
  svc: Record<string, OnboardingSvcPrice>;
  bundles: {
    essentials: OnboardingBundleVM | null;
    complete: OnboardingBundleVM | null;
  };
  /** Onboarding promo fraction (business rule, not a catalog value). */
  promo: number;
};

/** Onboarding promo — 20% off any in-app add-on added during onboarding. */
const ONBOARDING_PROMO = 0.2;

/**
 * Build the onboarding pricing view-model from the two live-catalog fetch
 * results. The single builder page.tsx calls.
 *
 * @param customer V2 customer SKUs (fetchV2CustomerCatalog()).
 * @param bundles  V2 package SKUs (fetchV2BundleCatalog()).
 * @param pax      estimated guest count, or null/undefined. Onboarding has NO
 *                 committed event at render time (the event row is lazily
 *                 created only at the final commit button), so this is
 *                 normally undefined → PAPIC_GUEST renders "from ₱2,999"
 *                 (formatSkuPriceLabel with no pax), matching /pricing's public
 *                 behavior. The authoritative pax charge is still recomputed
 *                 server-side at order time by resolvePaxPricedOrderCentavos.
 */
export function buildOnboardingPricing(
  customer: V2CustomerSku[],
  bundles: V2BundleSku[],
  pax?: number | null,
): OnboardingPricing {
  // Index by service_code — never rely on array order. fetchV2CustomerCatalog
  // returns ALL non-TODAYS_FOCUS rows (incl. SETNAYAN_AI, PRO_RSVP, etc.); we
  // pick only the 14 onboarding keys.
  const byCode = new Map<string, V2CustomerSku>();
  for (const sku of customer) byCode.set(sku.service_code, sku);

  const svc: Record<string, OnboardingSvcPrice> = {};
  for (const [inappKey, serviceCode] of Object.entries(INAPP_TO_SERVICE_CODE)) {
    const sku = byCode.get(serviceCode);
    if (!sku) {
      // Catalog read failure / missing row → safe ₱0 default (same failure
      // shape as the shell's old `?? {out:0,set:0}` fallback). Degrades to an
      // empty/₱0 row rather than crashing.
      svc[inappKey] = {
        set: 0,
        out: OUT_ANCHORS[inappKey] ?? 0,
        label: '',
        isPax: false,
        buildStatus: 'not_built',
      };
      continue;
    }
    svc[inappKey] = {
      // For the pax SKU, `set` stores the FLOOR pesos (used only as an
      // aggregate-math fallback in the onboarding estimate). `label` is the
      // display string — pax-correct ("from ₱X").
      set: sku.retail_price_php,
      out: OUT_ANCHORS[inappKey] ?? 0,
      label: formatSkuPriceLabel(sku, pax ?? null),
      isPax: sku.is_pax_priced,
      buildStatus: sku.build_status,
    };
  }

  const sumWorth = (members: string[]): number =>
    members.reduce((s, k) => s + (svc[k]?.set ?? 0), 0);

  const bundleVM = (
    code: string,
    members: string[],
  ): OnboardingBundleVM | null => {
    const pkg = bundles.find((b) => b.package_code === code);
    if (!pkg) return null;
    const worth = sumWorth(members);
    return {
      code: pkg.package_code,
      title: pkg.title,
      price: pkg.retail_price_php,
      worth,
      savings: Math.max(0, worth - pkg.retail_price_php),
    };
  };

  return {
    svc,
    bundles: {
      essentials: bundleVM('GUIDED_PACK', BUNDLE_MEMBERS.essentials),
      complete: bundleVM('MEDIA_PACK', BUNDLE_MEMBERS.complete),
    },
    promo: ONBOARDING_PROMO,
  };
}
