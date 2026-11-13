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
 *         The Thank You product (`papic_thank_you`) was RETIRED when the Thank-You Video went free (owner 2026-10-26,
 *         "let us remove thank you from the inapp purchase" → "make it free for now") — listed in
 *         `RETIRED_IAP_PRODUCT_IDS`, never reused.
 *       ↳ The eleven Event Hub Pro PART products (`hub_part_*`, 2026-10-22) were RETIRED before any was sold (owner
 *         2026-10-26, "just have the upgrade event hub pro") — Event Hub Pro is sold whole; their ids are listed in
 *         `RETIRED_HUB_PART_PRODUCT_IDS` and never reused.
 *   (2) Pro is offered in the app ONLY at ✓ Apply.
 *   (3) Pro and Live Watch are ONE purchase for the CURRENT event — a
 *       CONSUMABLE applied to that event, never a subscription and never a
 *       non-consumable (Apple sells a non-consumable once per Apple ID, for
 *       life, so a second event could never buy it).
 *   (4) ⚠ SUPERSEDED 2026-10-28 (DECISION_LOG "ONE PRICE EVERYWHERE = THE APP
 *       STORE PRICE"). Was: App Store price = web ÷ 0.85, rounded UP to Apple's
 *       next point. Now, owner verbatim: *"we make the price in app store and
 *       website same"* · *"we follow apple prices as our price"* — ONE price: the
 *       owner picks the Philippine App Store price point and sets the SAME figure
 *       as the website price in Admin › catalogue. Apple's price points are
 *       Apple's and the catalogue is the admin's — this file types neither.
 *       `appStorePriceMatchesWeb` is the check a sale is held to.
 *   (5) Papic credit packs: 100 · 500 · 1,000 · 5,000 · 10,000.
 *       ↳ ⚠ SUPERSEDED 2026-11-03 (DECISION_LOG "PAPIC IS THREE PACKS"): Papic is sold as THREE packs only —
 *         150 · 1,000 · 3,000 credits (one price on web and in the app — the figures live in the catalogue only). The five
 *         `papic_credits_*` products are RETIRED (`RETIRED_IAP_PRODUCT_IDS`, ids never reused) and three new
 *         `papic_pack_*` products sell the packs. New ids, not a reprice of `papic_credits_1000`, because the
 *         owner retired all five by name.
 *
 * 💰 FINAL PRICE SHEET (owner 2026-11-04, DECISION_LOG "FINAL PRICE SHEET — ONE PRICE, APPLE AND WEBSITE"; *"same price
 * for both"*). The app sells: Event Plus (`event_plus`, new — EVENT_PLUS, Papic credits (catalogue row; 1,000 since owner 2026-11-13) + Setnayan AI) · Event Pro
 * (`event_pro`, new — COUPLE_WEBSITE_PRO, Papic credits (catalogue row; 3,000 since owner 2026-11-13) + everything Plus has) · Papic 150 / 1000 / 3000 · Live
 * Watch · Music Maker · Patiktok. RETIRED from sale (ids forever; an already-charged transaction still delivers through
 * `iapProductForDelivery` in lib/iap/products-delivery.ts): `event_hub_pro` (replaced by `event_pro`, owner 2026-11-02)
 * and the four Setnayan AI products (owner 2026-11-04, *"Setnayan ai no separate purchase will be part of event plus and
 * event pro"*).
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
  /** Event Pro (COUPLE_WEBSITE_PRO) — and the retired `event_hub_pro` that sold the same code. */
  | 'event-hub-pro'
  /** 💰 Event Plus (owner 2026-11-04): one per event; never sold to an event that already has Pro. */
  | 'event-plus'
  | 'live-watch'
  | 'papic-credits'
  /** 🍎 23 Oct: one unlock for the CURRENT event, never sold twice (Music Maker · Patiktok; Setnayan AI and Thank You retired). */
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
   * ✦ The RETIRED Setnayan AI products only (owner 2026-10-23, "four consumables, one per web tier"; retired from sale
   * 2026-11-04, still delivered — lib/iap/products-delivery.ts): the web price TIER this product was sold for. All four sell the SAME `SETNAYAN_AI` order (one activation, one ownership), each priced in App Store
   * Connect from its tier's catalogue row (`AI_TIER_SKU`). The server refuses a tier product for an event of another tier.
   */
  aiTier?: Exclude<AiPriceTier, 'E'>;
};

const PREFIX = 'com.setnayan.app.';

/**
 * 🗑 EVENT HUB PRO, PART BY PART — RETIRED, NEVER OFFERED (owner 2026-10-26: "and just have the upgrade event hub pro"
 * … "i mean no more by part as well on the website"). The eleven part products of 2026-10-22 were made in App Store
 * Connect but never attached to a version and never sold; Event Hub Pro (`event_hub_pro`) is the one Event Hub product.
 * They are OUT of `IAP_PRODUCTS` — so StoreKit is never asked for them, `iapProductById` answers null and the server
 * refuses one by name — and kept HERE, the way `mood_board_renders_50` is kept in a comment, only so an id is never
 * reused (ids are forever). Spelled here, not derived from `lib/hub-parts.ts`'s table, so a renamed part can never
 * change one; `products.test.ts` holds the two lists equal.
 */
const RETIRED_HUB_PART_PRODUCTS: ReadonlyArray<readonly [part: string, serviceKey: string, name: string]> = [
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

/**
 * 📸 THE THREE PAPIC PACKS (owner 2026-11-03): `[credits, catalogue code]`. Prices are NOT here — App Store Connect
 * holds Apple's and `platform_retail_catalog_v2` the web's, and they are the same figure (owner 2026-11-04 sheet).
 */
const PAPIC_PACKS = [
  [150, 'PAPIC_GUEST_150'],
  [1_000, 'PAPIC_GUEST_1K'],
  [3_000, 'PAPIC_GUEST'],
] as const;

export const IAP_PRODUCTS: readonly IapProduct[] = Object.freeze([
  /* 💰 Event Plus and Event Pro (owner 2026-11-02 ids, DECISION_LOG "IN THE APP, EVENT PLUS = …"; names and one
     price 2026-11-04). `event_pro` replaces `event_hub_pro` (retired, still delivered — products-delivery.ts). */
  {
    productId: `${PREFIX}event_plus`,
    serviceKey: 'EVENT_PLUS',
    kind: 'event-plus',
    appleType: 'consumable',
    appStoreName: 'Event Plus',
    credits: null,
  },
  {
    productId: `${PREFIX}event_pro`,
    serviceKey: EVENT_HUB_PRO_SERVICE_KEY,
    kind: 'event-hub-pro',
    appleType: 'consumable',
    appStoreName: 'Event Pro',
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
  ...PAPIC_PACKS.map(
    ([credits, serviceKey]): IapProduct => ({
      productId: `${PREFIX}papic_pack_${credits}`,
      serviceKey,
      kind: 'papic-credits',
      appleType: 'consumable',
      // "Papic 150" · "Papic 1000" · "Papic 3000" — the owner's names (2026-11-04), no thousands comma.
      appStoreName: `Papic ${credits}`,
      credits,
    }),
  ),
  /*
   * 🍎 Music Maker and Patiktok (owner 2026-10-23, "five more Apple products"): CONSUMABLE, for the CURRENT event,
   * activated by the web's own hook. The ids were named by the controller and are FOREVER.
   * 🗑 The four Setnayan AI products (`setnayan_ai`, `setnayan_ai_tier_b/c/d`) left sale 2026-11-04 — Setnayan AI comes
   * with Event Plus and Event Pro. They live in lib/iap/products-delivery.ts (delivery only); never re-add them here.
   */
  ...(
    [
      ['music_maker', 'PAKANTA', 'Music Maker'],
      ['patiktok', 'PATIKTOK_COMPILER', 'Patiktok'],
      /* 🗑 `papic_thank_you` (PAPIC_ADDON_THANK_YOU) is RETIRED — the Thank-You Video is free for every event (owner
         2026-10-26). Kept in `RETIRED_IAP_PRODUCT_IDS`; never re-add it here, never reuse its id. */
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
 * 💝 THE SUPPLIER GIFT PRODUCTS (owner 2026-11-04, "GIFT PRICES" + *"they can purchase inside apple as well"*): what a
 * Verified-and-up SUPPLIER pays to gift one of the couple's products, sold in the iPhone app through Apple. The price
 * is the row's `gift_price_php` in `platform_retail_catalog_v2` (never typed here); in App Store Connect each is set to
 * the Philippine price point equal to that figure (build-sessions/APPLE-IAP-PRICES-2026-11-04.md).
 *
 * ⚠ DELIBERATELY NOT IN `IAP_PRODUCTS`, so NOT in `IAP_PRODUCT_IDS` and NOT answered by `iapProductById`: the purchase
 * path (`startAppStorePurchase`) is a COUPLE's — event-scoped and coordinator-checked — and has no supplier buyer, no
 * recipient event and no gift delivery. Listing these there would let a couple buy their own product at the gift price.
 * They join the sellable list only together with a supplier-buyer intent + delivery (not built — PR body). Ids are
 * FOREVER once created in App Store Connect.
 */
export type IapSupplierGiftProduct = {
  productId: string;
  /** The couple product gifted — its catalogue row carries the `gift_price_php` this product is priced from. */
  serviceKey: string;
  appleType: 'consumable';
  appStoreName: string;
  /** Papic packs: the credits gifted (re-checked against `papic_pass_tiers` exactly as `papicCreditsMatch`). */
  credits: number | null;
};

export const IAP_SUPPLIER_GIFT_PRODUCTS: readonly IapSupplierGiftProduct[] = Object.freeze([
  ...PAPIC_PACKS.map(
    ([credits, serviceKey]): IapSupplierGiftProduct => ({
      productId: `${PREFIX}gift_papic_pack_${credits}`,
      serviceKey,
      appleType: 'consumable',
      appStoreName: `Gift · Papic ${credits}`,
      credits,
    }),
  ),
  ...(
    [
      ['gift_event_plus', 'EVENT_PLUS', 'Gift · Event Plus'],
      ['gift_event_pro', EVENT_HUB_PRO_SERVICE_KEY, 'Gift · Event Pro'],
      ['gift_live_watch', 'LIVE_STUDIO', 'Gift · Live Watch'],
      ['gift_music_maker', 'PAKANTA', 'Gift · Music Maker'],
      ['gift_patiktok', 'PATIKTOK_COMPILER', 'Gift · Patiktok'],
    ] as const
  ).map(
    ([id, serviceKey, name]): IapSupplierGiftProduct => ({
      productId: `${PREFIX}${id}`,
      serviceKey,
      appleType: 'consumable',
      appStoreName: name,
      credits: null,
    }),
  ),
]);

/**
 * A pack bought again and again (Papic credits): never refused as "owned", and left out of Restore's list of things
 * switched on (a restored pack is credits already spent or still there, not a feature).
 */
export function iapProductIsRepeatable(product: IapProduct | null | undefined): boolean {
  return product?.kind === 'papic-credits';
}

/** 🗑 The eleven retired part products' ids, in the parts' own order — never sold, never reused. */
export const RETIRED_HUB_PART_PRODUCT_IDS: readonly string[] = RETIRED_HUB_PART_PRODUCTS.map(([part]) => `${PREFIX}hub_part_${part}`);

/** The catalogue code each retired part product would have sold — `products.test.ts` holds them to the parts table. */
export const RETIRED_HUB_PART_SERVICE_KEYS: readonly string[] = RETIRED_HUB_PART_PRODUCTS.map(([, serviceKey]) => serviceKey);

/**
 * 🗑 App Store products made in App Store Connect and RETIRED — never sold, never asked of StoreKit, never reused
 * (ids are forever). `mood_board_renders_50` predates this list and stays named in comments above.
 */
export const RETIRED_IAP_PRODUCT_IDS: readonly string[] = Object.freeze([
  // The eleven Event Hub Pro parts — Event Hub Pro is sold whole (owner 2026-10-26).
  ...RETIRED_HUB_PART_PRODUCT_IDS,
  // The Thank-You Video went free for every event (owner 2026-10-26, "make it free for now").
  `${PREFIX}papic_thank_you`,
  // The five `papic_credits_*` products retired 2026-11-03, and `event_hub_pro` + the four Setnayan AI products retired
  // 2026-11-04, are listed in lib/iap/products-delivery.ts (RETIRED_PAPIC_CREDIT_PRODUCT_IDS ·
  // RETIRED_EVENT_PRODUCT_IDS) — they still DELIVER an already-charged transaction, and are kept out of this
  // client-read file for the first-load budget.
]);

/** Every product id, for StoreKit's `Product.products(for:)`. */
export const IAP_PRODUCT_IDS: readonly string[] = IAP_PRODUCTS.map((p) => p.productId);

export function iapProductById(productId: string | null | undefined): IapProduct | null {
  if (!productId) return null;
  return IAP_PRODUCTS.find((p) => p.productId === productId) ?? null;
}

/** The product that sells this catalogue code (`COUPLE_WEBSITE_PRO` → `event_pro`). */
export function iapProductForServiceKey(serviceKey: string): IapProduct | null {
  return IAP_PRODUCTS.find((p) => p.serviceKey === serviceKey) ?? null;
}

/**
 * ✦ The Setnayan AI product for a web price tier. 🗑 Since 2026-11-04 Setnayan AI is NOT sold on its own (it comes with
 * Event Plus and Event Pro), so this answers null for every tier — a page that drew an Apple door from it draws none.
 */
export function iapSetnayanAiProductForTier(tier: AiPriceTier | null | undefined): IapProduct | null {
  if (!tier || tier === 'E') return null;
  return IAP_PRODUCTS.find((p) => p.aiTier === tier) ?? null;
}

/**
 * The catalogue row an Apple price is checked against (ruling 4, one price everywhere) — the product's own code, except a
 * (retired) Setnayan AI tier product being delivered, which is checked against its tier's row (`AI_TIER_SKU`, the one tier → row map the web
 * charges from).
 */
export function iapPriceRowFor(product: IapProduct): string {
  return product.aiTier ? (AI_TIER_SKU[product.aiTier] ?? product.serviceKey) : product.serviceKey;
}

/** The Papic packs, smallest first — the stepper walks exactly these. */
export const IAP_PAPIC_PRODUCTS: readonly IapProduct[] = IAP_PRODUCTS.filter(
  (p) => p.kind === 'papic-credits',
).sort((a, b) => (a.credits ?? 0) - (b.credits ?? 0));

/**
 * How far an App Store sale may sit from the website price and still be "the same price" (ruling 4, as superseded
 * 2026-10-28): ₱0.50.
 *
 * Why that figure: Philippine App Store price points are whole pesos, so two DIFFERENT points are at least ₱1 apart —
 * anything under ₱1 cannot hide a wrong point. What it must absorb is rounding only: Apple reports the price in
 * milli-units and `chargedPhp` rounds it to the centavo, and the catalogue stores centavos. Half a peso is clear of
 * both and strictly below the smallest real gap.
 */
export const APP_STORE_PRICE_TOLERANCE_PHP = 0.5;

/**
 * Is what Apple charged THE website price (ruling 4: one price everywhere)? `webPhp` is what a website buyer pays for
 * the same item — the catalogue row, grossed by the effective VAT rate (0 today). Null when there is nothing to
 * compare (a missing or non-positive figure on either side): a guessed verdict is worse than none.
 */
export function appStorePriceMatchesWeb(
  applePhp: number | null | undefined,
  webPhp: number | null | undefined,
): boolean | null {
  const ok = (n: number | null | undefined): n is number => typeof n === 'number' && Number.isFinite(n) && n > 0;
  if (!ok(applePhp) || !ok(webPhp)) return null;
  return Math.abs(applePhp - webPhp) < APP_STORE_PRICE_TOLERANCE_PHP;
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
