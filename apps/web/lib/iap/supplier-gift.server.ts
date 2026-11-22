import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import { fetchShopPapicPacks } from '@/lib/vendor-papic-grants';
import { fetchShopGiftBundles, fetchShopGiftPacks, fetchShopGiftUnlockRows } from '@/lib/shop-gifts.server';
import { isVendorPapicCaptureEnabled } from '@/lib/vendor-dayof-flags';
import { shopGiftKindOf, shopGiftServiceKey, type ShopGiftKind } from '@/lib/shop-gifts';
import { papicCreditsMatch, type IapSupplierGiftProduct } from './products';
import { appleGiftDelivery, type AppleGiftDelivery } from './apple-gift-lines';

/**
 * 💝 A SHOP'S GIFT, BOUGHT THROUGH APPLE — the facts the purchase path needs that the couple path does not.
 * (Owner 2026-11-04, *"they can purchase inside apple as well"*; controller 22 Nov: "delivered exactly like a web gift";
 * owner 22 Nov: the in-app cart pays LINE BY LINE, one Apple purchase per line with a quantity.)
 *
 *   · `appleGiftOnSale` — the SAME reads the web's gift buy makes (`buyVendorPapicPortfolioPack`, `for=gift`): a Papic
 *     gift rides the Papic switch and its catalogue row + tier; an Event Plus / Pro / Ultra gift its catalogue row.
 *     A Papic gift's credits must still be what its App Store name promises (`papicCreditsMatch`).
 *   · `appleGiftDeliveryFor` — what a purchase lands, by the quantity APPLE SIGNED: singles, or the 10 + 1 bundle.
 *   · `appleGiftPurchaseRow` — the `shop_gift_purchases` row a web gift order carries, for ONE Apple purchase at the
 *     price Apple charged. Approval's `grantShopGiftPurchase` reads it and lands the gift in `shop_gift_stock_entries`,
 *     exactly as it does for a web gift (`quantity × packs_each`); a refund's `reverseShopGiftPurchase` takes it back.
 *
 * The ORDER is `vendor_gift__<code>` (`appleGiftOrderKey`) — the web gift's own key, so activation and reversal run
 * the web gift's hooks unchanged.
 */

export function appleGiftOrderKey(product: IapSupplierGiftProduct): string {
  return shopGiftServiceKey(product.serviceKey);
}

export async function appleGiftOnSale(
  admin: SupabaseClient,
  product: IapSupplierGiftProduct,
): Promise<'on_sale' | 'not_on_sale' | 'error'> {
  const kind = shopGiftKindOf(product.serviceKey);
  if (!kind) return 'not_on_sale';
  if (kind === 'papic') {
    // Owner 2026-10-25: "No. Papic needs to be on." — for Papic gifts, as on the web.
    if (!(await isVendorPapicCaptureEnabled())) return 'not_on_sale';
    const packs = await fetchShopPapicPacks(admin);
    if (packs === null) return 'error';
    const pack = packs.find((p) => p.code === product.serviceKey);
    if (!pack) return 'not_on_sale';
    return papicCreditsMatch(product, pack.credits) ? 'on_sale' : 'not_on_sale';
  }
  const rows = await fetchShopGiftUnlockRows(admin);
  if (rows === null) return 'error';
  return rows.some((r) => r.code === product.serviceKey) ? 'on_sale' : 'not_on_sale';
}

/**
 * 💝 What ONE Apple gift purchase lands, by the quantity Apple SIGNED (`appleGiftDelivery`). One is a single — no read.
 * More reads the bundles on sale with the web store's own reader (`fetchShopGiftBundles`): a quantity equal to a live
 * bundle's paid count lands that bundle's catalogue count. Null on a read failure (Apple re-delivers).
 */
export async function appleGiftDeliveryFor(
  admin: SupabaseClient,
  product: IapSupplierGiftProduct,
  signedQuantity: number,
): Promise<AppleGiftDelivery | null> {
  if (signedQuantity === 1) return appleGiftDelivery(product.serviceKey, 1, []);
  const packs = await fetchShopGiftPacks(admin);
  if (!packs) return null;
  const bundles = await fetchShopGiftBundles(admin, packs);
  if (!bundles) return null;
  return appleGiftDelivery(product.serviceKey, signedQuantity, bundles);
}

export type AppleGiftPurchaseRow = {
  order_id: string;
  vendor_profile_id: string;
  service_code: string;
  gift_kind: ShopGiftKind;
  quantity: number;
  credits_each: number;
  packs_each: number;
  bundle_code: string | null;
  unit_price_php: number;
  price_basis: 'list' | 'bundle';
  created_by: string;
};

/**
 * The row for one Apple purchase: its singles at the list price, or one 10 + 1 bundle (`packs_each` = the bundle's whole
 * count, `price_basis` 'bundle' — exactly as the web store writes a bundle). A Papic gift's credits are the product's own
 * per pack (`papicCreditsMatch` held them to the tier before Apple's sheet opened); an Event Plus / Pro / Ultra gift is
 * one unit per pack — as `fetchShopGiftUnlockRows` counts it on the web.
 */
export function appleGiftPurchaseRow(input: {
  orderId: string;
  vendorProfileId: string;
  userId: string;
  product: IapSupplierGiftProduct;
  delivery: AppleGiftDelivery;
  chargedPhp: number;
}): AppleGiftPurchaseRow | null {
  const kind = shopGiftKindOf(input.product.serviceKey);
  if (!kind) return null;
  const credits = kind === 'papic' ? input.product.credits : 1;
  const d = input.delivery;
  if (!credits || credits <= 0 || !(input.chargedPhp > 0) || d.quantity < 1 || d.packsEach < 1) return null;
  // One unit of a bundle is its whole count: Papic `packs_each` packs, an Event Plus / Pro / Ultra `packs_each` units
  // (`shop_gift_purchases_unlock_is_one_per_pack`, migration 20271358270977).
  return {
    order_id: input.orderId,
    vendor_profile_id: input.vendorProfileId,
    service_code: input.product.serviceKey,
    gift_kind: kind,
    quantity: d.quantity,
    credits_each: credits * d.packsEach,
    packs_each: d.packsEach,
    bundle_code: d.bundleCode,
    // What Apple charged, per unit of the row (a bundle's one unit is the whole purchase — exact, never split).
    unit_price_php: Math.round((input.chargedPhp / d.quantity) * 100) / 100,
    price_basis: d.priceBasis,
    created_by: input.userId,
  };
}
