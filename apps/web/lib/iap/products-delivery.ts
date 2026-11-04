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
 * The product an Apple TRANSACTION is delivered as: anything on sale, plus a retired Papic credit product (see
 * `RETIRED_PAPIC_CREDIT_PRODUCTS`). Only the transaction reader uses this; everything that SELLS uses `iapProductById`.
 */
export function iapProductForDelivery(productId: string | null | undefined): IapProduct | null {
  return iapProductById(productId) ?? RETIRED_PAPIC_CREDIT_PRODUCTS.find((p) => p.productId === productId) ?? null;
}


/** 🗑 The five retired Papic credit product ids — never sold again, never asked of StoreKit, never reused. */
export const RETIRED_PAPIC_CREDIT_PRODUCT_IDS: readonly string[] = RETIRED_PAPIC_CREDIT_PRODUCTS.map((p) => p.productId);
