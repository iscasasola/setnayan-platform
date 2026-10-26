import { AI_TIER_SKU, type AiPriceTier } from '@/lib/setnayan-ai-type-pricing';

/**
 * 🍎 THE APP STORE PRODUCTS — the ONE file that names them.
 *
 * Owner, 2026-10-18 (DECISION_LOG "IN-APP PURCHASE — THE FIVE DECISIONS"),
 * verbatim: *"Yes — use all five in-app purchase recommendations and start the
 * in-app purchase build."* So:
 *
 *   (1) Sold in the iPhone app first: Papic credits, Event Hub Pro, Live Watch.
 *       Setnayan AI is a second wave; supplier plans stay web-only.
 *       ↳ The second wave (owner 2026-10-23): Setnayan AI, Music Maker, Patiktok,
 *         Thank You and the Mood Board pack — see the end of IAP_PRODUCTS. The Mood Board pack
 *         (`mood_board_renders_50`) was RETIRED with the renders (owner 2026-10-26) — its id is never reused.
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

/**
 * `COUPLE_WEBSITE_PRO_SERVICE_KEY` (lib/couple-website-pro.ts), spelled here
 * because that module reaches the server-only admin client and this one is
 * read by the iPhone app's client sheets. products.test.ts holds the two equal.
 */
const EVENT_HUB_PRO_SERVICE_KEY = 'COUPLE_WEBSITE_PRO';

export type IapProductKind =
  | 'event-hub-pro'
  | 'event-hub-part'
  | 'live-watch'
  | 'papic-credits'
  /** 🍎 23 Oct: one unlock for the CURRENT event, never sold twice (Setnayan AI · Music Maker · Patiktok · Thank You). */
  | 'event-unlock';

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
  /** Papic packs: the credits this product's name promises. */
  credits: number | null;
  /**
   * ✦ Setnayan AI only (owner 2026-10-23, "four consumables, one per web tier"): the web price TIER this product is
   * sold for. All four sell the SAME `SETNAYAN_AI` order (one activation, one ownership), each priced in App Store
   * Connect from its tier's catalogue row (`AI_TIER_SKU`). The server refuses a tier product for an event of another tier.
   */
  aiTier?: Exclude<AiPriceTier, 'E'>;
};

const PREFIX = 'com.setnayan.app.';

/**
 * 💎 EVENT HUB PRO, PART BY PART — in the iPhone app 1.1 (owner 2026-10-22, "yes to all"; flag-dark behind the one IAP
 * gate, `SetnayanIAP/2` + the owner's switch): each of the eleven parts is a fixed-price Apple product (CONSUMABLE, for
 * the current event — ruling 3), floor = web ÷ 0.85 like every product here (ruling 4). An in-app part counts its WEB
 * value toward everything (the cap reads the catalogue, never Apple's price). Once any part is owned the app hides
 * "Everything" (finish on the web — which the app may not say). Spelled here, not imported from `lib/hub-parts.ts`'s
 * table, only so a renamed part can never silently change a PRODUCT ID (ids are forever); `products.test.ts` holds the
 * two lists equal.
 */
const HUB_PART_PRODUCTS: ReadonlyArray<readonly [part: string, serviceKey: string, name: string]> = [
  ['reveal', 'COUPLE_HUB_PART_REVEAL', 'Reveal'],
  ['background', 'COUPLE_HUB_PART_BACKGROUND', 'Background'],
  ['photos', 'COUPLE_HUB_PART_PHOTOS', 'Photos'],
  ['style', 'COUPLE_HUB_PART_STYLE', 'Style'],
  ['motion', 'COUPLE_HUB_PART_MOTION', 'Motion'],
  ['logo_qr', 'COUPLE_HUB_PART_LOGO_QR', 'Logo & QR'],
  ['music', 'COUPLE_HUB_PART_MUSIC', 'Music'],
  ['prints', 'COUPLE_HUB_PART_PRINTS', 'Prints'],
  ['post_event', 'COUPLE_HUB_PART_POST_EVENT', 'Post Event'],
  ['own_scenes', 'COUPLE_HUB_PART_OWN_SCENES', 'Your own scenes'],
  ['address', 'COUPLE_HUB_PART_ADDRESS', 'Custom address'],
];

export const IAP_PRODUCTS: readonly IapProduct[] = Object.freeze([
  {
    productId: `${PREFIX}event_hub_pro`,
    serviceKey: EVENT_HUB_PRO_SERVICE_KEY,
    kind: 'event-hub-pro',
    appleType: 'consumable',
    appStoreName: 'Event Hub Pro',
    credits: null,
  },
  ...HUB_PART_PRODUCTS.map(
    ([part, serviceKey, name]): IapProduct => ({
      productId: `${PREFIX}hub_part_${part}`,
      serviceKey,
      kind: 'event-hub-part',
      appleType: 'consumable',
      appStoreName: `Event Hub Pro · ${name}`,
      credits: null,
    }),
  ),
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
  /*
   * 🍎 FIVE MORE (owner 2026-10-23, verbatim: "Add Setnayan AI, Music Maker, Patiktok, Thank You and Mood Board
   * pack as Apple products before submitting build 6.") Same model as Live Watch: CONSUMABLE, for the CURRENT event,
   * activated by the web's own hook. The ids were named by the controller and are FOREVER.
   */
  /*
   * ✦ SETNAYAN AI, ONE PRODUCT PER WEB TIER (owner 2026-10-23): Apple has one price per product, the web four rungs.
   * `setnayan_ai` stays Tier A (the wedding, the plain SETNAYAN_AI row) — never renamed; B · C · D are their own ids.
   * Tier E (simple event) has no product, as it has no price on the web.
   */
  ...(
    [
      ['setnayan_ai', 'A'],
      ['setnayan_ai_tier_b', 'B'],
      ['setnayan_ai_tier_c', 'C'],
      ['setnayan_ai_tier_d', 'D'],
    ] as const
  ).map(
    ([id, aiTier]): IapProduct => ({
      productId: `${PREFIX}${id}`,
      serviceKey: 'SETNAYAN_AI',
      kind: 'event-unlock',
      appleType: 'consumable',
      appStoreName: 'Setnayan AI',
      credits: null,
      aiTier,
    }),
  ),
  ...(
    [
      ['music_maker', 'PAKANTA', 'Music Maker'],
      ['patiktok', 'PATIKTOK_COMPILER', 'Patiktok'],
      ['papic_thank_you', 'PAPIC_ADDON_THANK_YOU', 'Thank You'],
    ] as const
  ).map(
    ([id, serviceKey, name]): IapProduct => ({
      productId: `${PREFIX}${id}`,
      serviceKey,
      kind: 'event-unlock',
      appleType: 'consumable',
      appStoreName: name,
      credits: null,
    }),
  ),
  /* 🗑 `mood_board_renders_50` ("Mood Board · 50 renders") is RETIRED with Mood Board renders (owner 2026-10-26,
     "mood board render is no longer available. can we delete that?"). Never re-add it, and never reuse its id. */
]);

/**
 * A pack bought again and again (Papic credits): never refused as "owned", and left out of Restore's list of things
 * switched on (a restored pack is credits already spent or still there, not a feature).
 */
export function iapProductIsRepeatable(product: IapProduct | null | undefined): boolean {
  return product?.kind === 'papic-credits';
}

/** The eleven part products, in the parts' own order. */
export const IAP_HUB_PART_PRODUCTS: readonly IapProduct[] = IAP_PRODUCTS.filter((p) => p.kind === 'event-hub-part');

/** Every product id, for StoreKit's `Product.products(for:)`. */
export const IAP_PRODUCT_IDS: readonly string[] = IAP_PRODUCTS.map((p) => p.productId);

export function iapProductById(productId: string | null | undefined): IapProduct | null {
  if (!productId) return null;
  return IAP_PRODUCTS.find((p) => p.productId === productId) ?? null;
}

/**
 * The product that sells this catalogue code. For `SETNAYAN_AI` that is Tier A's (`setnayan_ai`) — a page that knows
 * the event's tier asks `iapSetnayanAiProductForTier` instead.
 */
export function iapProductForServiceKey(serviceKey: string): IapProduct | null {
  return IAP_PRODUCTS.find((p) => p.serviceKey === serviceKey) ?? null;
}

/** ✦ The Setnayan AI product for a web price tier; null for Tier E (not offered) or no tier. */
export function iapSetnayanAiProductForTier(tier: AiPriceTier | null | undefined): IapProduct | null {
  if (!tier || tier === 'E') return null;
  return IAP_PRODUCTS.find((p) => p.aiTier === tier) ?? null;
}

/**
 * ✦ May THIS product be sold to an event of THIS tier? Only its own tier: a Tier D product can never unlock a wedding,
 * and a wedding can never be sold the Tier D price. Every other product has no tier and is unaffected.
 */
export function iapProductFitsAiTier(product: IapProduct, eventTier: AiPriceTier | null): boolean {
  if (!product.aiTier) return true;
  return eventTier !== null && product.aiTier === eventTier;
}

/**
 * The catalogue row an Apple price is floored on (ruling 4, web ÷ 0.85) — the product's own code, except a Setnayan AI
 * tier product, which is floored on its tier's row (`AI_TIER_SKU`, the one tier → row map the web charges from).
 */
export function iapPriceRowFor(product: IapProduct): string {
  return product.aiTier ? (AI_TIER_SKU[product.aiTier] ?? product.serviceKey) : product.serviceKey;
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

/**
 * The payment `channel` and the order's `payment_method_key` of every App Store purchase — ONE spelling, read by
 * the fulfilment (`fulfil.server.ts` `APP_STORE_CHANNEL`) and by Home's "bought in the app" (`where-bought.ts`).
 */
export const APP_STORE_CHANNEL_KEY = 'app_store';
