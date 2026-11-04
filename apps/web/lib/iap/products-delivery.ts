import { iapProductById, type IapProduct } from './products';

/*
 * Kept OUT of lib/iap/products.ts on purpose: that file is read by the iPhone app's client sheets, so anything added
 * there ships in the first-load JavaScript of every page that mounts one (the Event Hub Maker's budget caught it).
 * Only the transaction reader (lib/iap/apple-transaction.ts, server-side) needs the retired products.
 */

/**
 * 🗑 The five retired Papic credit products, kept ONLY so an Apple transaction already charged for one still delivers
 * its credits (an in-flight purchase, a late server notification, a refund). Never in `IAP_PRODUCTS`: StoreKit is
 * never asked for them and `startAppStorePurchase` refuses them (`iapProductById` answers null), so a NEW sale cannot
 * start — and a delivery needs the intent row that only a sale started before 2026-11-03 could have written. Their
 * catalogue codes keep their activation hooks in lib/sku-activation.ts.
 */
const RETIRED_PAPIC_CREDIT_PRODUCTS: readonly IapProduct[] = Object.freeze(
  (
    [
      [100, 'PAPIC_GUEST_100'],
      [500, 'PAPIC_GUEST_500'],
      [1_000, 'PAPIC_GUEST_1K'],
      [5_000, 'PAPIC_GUEST_5K'],
      [10_000, 'PAPIC_GUEST_10K'],
    ] as const
  ).map(
    ([credits, serviceKey]): IapProduct => ({
      productId: `com.setnayan.app.papic_credits_${credits}`,
      serviceKey,
      kind: 'papic-credits',
      appleType: 'consumable',
      appStoreName: `Papic · ${credits.toLocaleString('en-US')} credits`,
      credits,
    }),
  ),
);

/**
 * 🗑 RETIRED FROM SALE 2026-11-04 (owner's final price sheet), same contract as the Papic credit products above —
 * delivery of an already-charged transaction only, never sold, never asked of StoreKit, ids never reused:
 *   · `event_hub_pro` — replaced by `event_pro` (owner 2026-11-02, DECISION_LOG "IN THE APP, EVENT PLUS = …"). It
 *     sold the same COUPLE_WEBSITE_PRO order, so a late transaction still switches Pro on.
 *   · the four Setnayan AI products — *"Setnayan ai no separate purchase will be part of event plus and event pro"*.
 *     Each keeps its `aiTier`, so the delivery's price check reads its tier's own catalogue row (`iapPriceRowFor`).
 */
const RETIRED_EVENT_PRODUCTS: readonly IapProduct[] = Object.freeze([
  {
    productId: 'com.setnayan.app.event_hub_pro',
    serviceKey: 'COUPLE_WEBSITE_PRO',
    kind: 'event-hub-pro',
    appleType: 'consumable',
    appStoreName: 'Event Hub Pro',
    credits: null,
  },
  ...(
    [
      ['setnayan_ai', 'A'],
      ['setnayan_ai_tier_b', 'B'],
      ['setnayan_ai_tier_c', 'C'],
      ['setnayan_ai_tier_d', 'D'],
    ] as const
  ).map(
    ([id, aiTier]): IapProduct => ({
      productId: `com.setnayan.app.${id}`,
      serviceKey: 'SETNAYAN_AI',
      kind: 'event-unlock',
      appleType: 'consumable',
      appStoreName: 'Setnayan AI',
      credits: null,
      aiTier,
    }),
  ),
]);

/**
 * The product an Apple TRANSACTION is delivered as: anything on sale, plus a retired product (see
 * `RETIRED_PAPIC_CREDIT_PRODUCTS` · `RETIRED_EVENT_PRODUCTS`). Only the transaction reader uses this; everything that
 * SELLS uses `iapProductById`.
 */
export function iapProductForDelivery(productId: string | null | undefined): IapProduct | null {
  return (
    iapProductById(productId) ??
    RETIRED_PAPIC_CREDIT_PRODUCTS.find((p) => p.productId === productId) ??
    RETIRED_EVENT_PRODUCTS.find((p) => p.productId === productId) ??
    null
  );
}

/** 🗑 The five retired Papic credit product ids — never sold again, never asked of StoreKit, never reused. */
export const RETIRED_PAPIC_CREDIT_PRODUCT_IDS: readonly string[] = RETIRED_PAPIC_CREDIT_PRODUCTS.map((p) => p.productId);

/** 🗑 `event_hub_pro` and the four Setnayan AI product ids (retired 2026-11-04) — delivered, never sold again. */
export const RETIRED_EVENT_PRODUCT_IDS: readonly string[] = RETIRED_EVENT_PRODUCTS.map((p) => p.productId);
