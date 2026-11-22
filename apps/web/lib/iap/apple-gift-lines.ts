/**
 * 💝 A SHOP'S GIFT CART IN THE IPHONE APP PAYS LINE BY LINE — PURE (no I/O), so the store, the buy action, the
 * fulfilment and the tests all use ONE rule. Owner ruling relayed by the controller, 2026-11-22:
 *
 *   · each cart line is ONE Apple payment: a consumable `com.setnayan.app.gift_*` bought with a QUANTITY (Face ID
 *     once per line). The website cart stays one payment;
 *   · a 10 + 1 bundle is its gift bought with quantity 10 — Setnayan DELIVERS the bundle's catalogue count
 *     (`bundle_quantity`, "buy 10, get 1 free"). There is NO Apple product for a bundle;
 *   · couple products stay at quantity 1.
 *
 * WHAT LANDS IS DECIDED BY THE QUANTITY APPLE SIGNED, never by what the phone asked for: Apple charged for exactly that
 * many. A signed quantity equal to a live bundle's PAID count (`bundlePaidCount` — worked out from the catalogue's two
 * prices, never typed) lands that bundle; any other quantity lands that many singles at the list price.
 *
 * 💰 No price here. The only number of ours is Apple's own limit per purchase (StoreKit's `quantity` option).
 */

import { bundleFreePacks, type ShopGiftBundle, type ShopGiftPack } from '../shop-gifts';
import { SHOP_GIFT_STORE_MOST_EACH, storeItems, type GiftCart } from '../shop-gift-cart';

/** StoreKit's limit on `Product.PurchaseOption.quantity` for a consumable — Apple's rule, not a price. */
export const APPLE_MOST_PER_PURCHASE = 10;

/** How many a bundle CHARGES for (its price ÷ its pack's list price) — "pay 10" of "pay 10, get 11". */
export function bundlePaidCount(b: Pick<ShopGiftBundle, 'quantity' | 'priceCentavos'> & { pack: Pick<ShopGiftPack, 'srpCentavos'> }): number {
  return b.quantity - bundleFreePacks(b);
}

/** Is `n` a quantity Apple may sign for ONE gift purchase? */
export function appleGiftQuantityOk(n: unknown): n is number {
  return typeof n === 'number' && Number.isInteger(n) && n >= 1 && n <= APPLE_MOST_PER_PURCHASE;
}

/** What one Apple gift purchase lands — the `shop_gift_purchases` shape a web gift order carries. */
export type AppleGiftDelivery = {
  /** Units of the row: singles bought, or 1 for a bundle. */
  quantity: number;
  /** Packs per unit: 1 for a single, the bundle's whole count (11) for a bundle. */
  packsEach: number;
  bundleCode: string | null;
  priceBasis: 'list' | 'bundle';
};

/**
 * What lands for `signedQuantity` of `packCode`. A live bundle of THIS pack whose paid count equals the signed quantity
 * lands the bundle; anything else lands that many singles. Null when the quantity is not one Apple may sign.
 */
export function appleGiftDelivery(
  packCode: string,
  signedQuantity: number,
  bundles: readonly ShopGiftBundle[],
): AppleGiftDelivery | null {
  if (!appleGiftQuantityOk(signedQuantity)) return null;
  const bundle = bundles.find((b) => b.pack.code === packCode && bundlePaidCount(b) === signedQuantity && b.quantity > signedQuantity);
  return bundle
    ? { quantity: 1, packsEach: bundle.quantity, bundleCode: bundle.code, priceBasis: 'bundle' }
    : { quantity: signedQuantity, packsEach: 1, bundleCode: null, priceBasis: 'list' };
}

/** One line of the in-app cart: ONE Apple purchase. */
export type AppleCartLine = {
  /** The cart code (a single's pack code or a bundle's `GIFT_BUNDLE_*` code). */
  code: string;
  pack: ShopGiftPack;
  bundle: ShopGiftBundle | null;
  /** How many of THIS line the shop picked (singles, or bundles). */
  qty: number;
  /** The quantity Apple is asked for: the singles, or the bundle's paid count. */
  appleQuantity: number;
  /** Packs it lands. */
  tickets: number;
};

/**
 * The most of one item in the in-app cart: a single stops at 9 (the web store's own rule), and a bundle at as many as
 * fit in ONE Apple purchase (a "pay 10" bundle → 1). A bundle that charges for more than Apple sells at once is not
 * sold in the app at all (0).
 */
export function appleMostOf(code: string, bundles: readonly ShopGiftBundle[]): number {
  const b = bundles.find((x) => x.code === code);
  if (!b) return Math.min(SHOP_GIFT_STORE_MOST_EACH, APPLE_MOST_PER_PURCHASE);
  const paid = bundlePaidCount(b);
  return paid > 0 ? Math.floor(APPLE_MOST_PER_PURCHASE / paid) : 0;
}

/** Why one more cannot go in the in-app cart (no money cap: Apple charges each line on its own). */
export function appleCanAdd(
  cart: GiftCart,
  code: string,
  packs: readonly ShopGiftPack[],
  bundles: readonly ShopGiftBundle[],
): 'ok' | 'most_each' | 'not_on_sale' {
  if (!storeItems(packs, bundles).some((i) => i.code === code)) return 'not_on_sale';
  const most = appleMostOf(code, bundles);
  if (most <= 0) return 'not_on_sale';
  return Math.max(0, Math.trunc(Number(cart[code] ?? 0))) + 1 > most ? 'most_each' : 'ok';
}

/** The in-app cart as Apple purchases, in the store's order. Lines Apple cannot sell in one purchase are dropped. */
export function appleCartLines(cart: GiftCart, packs: readonly ShopGiftPack[], bundles: readonly ShopGiftBundle[]): AppleCartLine[] {
  const out: AppleCartLine[] = [];
  for (const item of storeItems(packs, bundles)) {
    const qty = Math.trunc(Number(cart[item.code] ?? 0));
    if (qty <= 0) continue;
    const appleQuantity = item.bundle ? bundlePaidCount(item.bundle) * qty : qty;
    if (!appleGiftQuantityOk(appleQuantity)) continue;
    out.push({
      code: item.code,
      pack: item.pack,
      bundle: item.bundle,
      qty,
      appleQuantity,
      tickets: item.bundle ? item.bundle.quantity * qty : qty,
    });
  }
  return out;
}
