/**
 * 🍎 THE APP STORE PRODUCTS — the ONE file that names them.
 *
 * Owner, 2026-10-18 (DECISION_LOG "IN-APP PURCHASE — THE FIVE DECISIONS"),
 * verbatim: *"Yes — use all five in-app purchase recommendations and start the
 * in-app purchase build."* So:
 *
 *   (1) Sold in the iPhone app first: Papic credits, Event Hub Pro, Live Watch.
 *       Setnayan AI is a second wave; supplier plans stay web-only.
 *   (2) Pro is offered in the app ONLY at ✓ Apply.
 *   (3) Pro and Live Watch are ONE purchase for the CURRENT event — a
 *       CONSUMABLE applied to that event, never a subscription and never a
 *       non-consumable (Apple sells a non-consumable once per Apple ID, for
 *       life, so a second event could never buy it).
 *   (4) App Store price = web price ÷ 0.85, rounded UP to Apple's next price
 *       point (Apple keeps 15 %). Apple's price points are Apple's — this file
 *       never types one. `appStorePriceFloorPhp` is the floor the owner picks
 *       the point AT OR ABOVE, computed from the live catalogue row.
 *   (5) Papic credit packs: 100 · 500 · 1,000 · 5,000 · 10,000.
 *
 * 🔑 NO PRICE LIVES HERE. The app shows the price StoreKit returns
 * (`Product.displayPrice`); the web keeps `platform_retail_catalog_v2`. Two
 * numbers, one item, never side by side (prototype
 * `in_app_purchase_screens_2026-10-17_fable.html`, "Under the sheet").
 *
 * 🔑 THE CREDIT COUNT IS A CLAIM THE SERVER RE-CHECKS. A product's `credits`
 * is what its App Store name promises ("Papic · 500 credits"); the points
 * actually granted come from `papic_pass_tiers` through the existing activation
 * hook. The intent step refuses a Papic product whose tier no longer grants
 * exactly this many (`papicCreditsMatch`), so an admin edit to the ladder can
 * never make the App Store name lie.
 *
 * ⚠ PRODUCT IDS ARE FOREVER. App Store Connect never lets a deleted product id
 * be reused. Rename the display name freely; never edit an id below once it
 * exists in App Store Connect — add a new one.
 */

import { COUPLE_WEBSITE_PRO_SERVICE_KEY } from '@/lib/couple-website-pro';

export type IapProductKind = 'event-hub-pro' | 'live-watch' | 'papic-credits';

export type IapProduct = {
  /** The App Store Connect product id. */
  productId: string;
  /** Our catalogue code — the `orders.service_key` the activation path keys on. */
  serviceKey: string;
  kind: IapProductKind;
  /** Apple's type. Every item here is CONSUMABLE (rulings 3 and 5). */
  appleType: 'consumable';
  /** The App Store display name the owner types in App Store Connect. */
  appStoreName: string;
  /** Papic only: the credits this product's name promises. */
  credits: number | null;
};

const PREFIX = 'com.setnayan.app.';

export const IAP_PRODUCTS: readonly IapProduct[] = Object.freeze([
  {
    productId: `${PREFIX}event_hub_pro`,
    serviceKey: COUPLE_WEBSITE_PRO_SERVICE_KEY,
    kind: 'event-hub-pro',
    appleType: 'consumable',
    appStoreName: 'Event Hub Pro',
    credits: null,
  },
  {
    productId: `${PREFIX}live_watch`,
    serviceKey: 'LIVE_STUDIO',
    kind: 'live-watch',
    appleType: 'consumable',
    appStoreName: 'Live Watch',
    credits: null,
  },
  ...(
    [
      [100, 'PAPIC_GUEST_100'],
      [500, 'PAPIC_GUEST_500'],
      [1_000, 'PAPIC_GUEST_1K'],
      [5_000, 'PAPIC_GUEST_5K'],
      [10_000, 'PAPIC_GUEST_10K'],
    ] as const
  ).map(
    ([credits, serviceKey]): IapProduct => ({
      productId: `${PREFIX}papic_credits_${credits}`,
      serviceKey,
      kind: 'papic-credits',
      appleType: 'consumable',
      appStoreName: `Papic · ${credits.toLocaleString('en-US')} credits`,
      credits,
    }),
  ),
]);

/** Every product id, for StoreKit's `Product.products(for:)`. */
export const IAP_PRODUCT_IDS: readonly string[] = IAP_PRODUCTS.map((p) => p.productId);

export function iapProductById(productId: string | null | undefined): IapProduct | null {
  if (!productId) return null;
  return IAP_PRODUCTS.find((p) => p.productId === productId) ?? null;
}

export function iapProductForServiceKey(serviceKey: string): IapProduct | null {
  return IAP_PRODUCTS.find((p) => p.serviceKey === serviceKey) ?? null;
}

/** The Papic packs, smallest first — the stepper walks exactly these. */
export const IAP_PAPIC_PRODUCTS: readonly IapProduct[] = IAP_PRODUCTS.filter(
  (p) => p.kind === 'papic-credits',
).sort((a, b) => (a.credits ?? 0) - (b.credits ?? 0));

/** Apple's cut under the Small Business Program (ruling 4): the app price is web ÷ (1 − 0.15). */
export const APP_STORE_NET_SHARE = 0.85;

/**
 * The LOWEST App Store price (₱) that still nets the web price after Apple's
 * 15 % — web ÷ 0.85, rounded UP to the centavo. The owner picks Apple's price
 * point AT OR ABOVE this in App Store Connect (ruling 4). Null for a missing or
 * non-positive web price: there is nothing to compute from, and a guessed floor
 * is worse than none.
 */
export function appStorePriceFloorPhp(webPricePhp: number | null | undefined): number | null {
  if (typeof webPricePhp !== 'number' || !Number.isFinite(webPricePhp) || webPricePhp <= 0) return null;
  // Work in centavos so 70 / 0.85 = 82.352… rounds to 82.36, never 82.35.
  const centavos = Math.ceil((Math.round(webPricePhp * 100) * 100) / (APP_STORE_NET_SHARE * 100) - 1e-9);
  return centavos / 100;
}

/**
 * Does the Papic tier still grant exactly what the App Store name promises?
 * `tierPoints` null = the tier is missing or retired → not on sale.
 */
export function papicCreditsMatch(product: IapProduct, tierPoints: number | null): boolean {
  if (product.kind !== 'papic-credits') return true;
  return tierPoints !== null && product.credits === tierPoints;
}
