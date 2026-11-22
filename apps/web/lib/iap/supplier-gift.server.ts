import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import { fetchShopPapicPacks } from '@/lib/vendor-papic-grants';
import { fetchShopGiftUnlockRows } from '@/lib/shop-gifts.server';
import { isVendorPapicCaptureEnabled } from '@/lib/vendor-dayof-flags';
import { shopGiftKindOf, shopGiftServiceKey, type ShopGiftKind } from '@/lib/shop-gifts';
import { papicCreditsMatch, type IapSupplierGiftProduct } from './products';

/**
 * 💝 A SHOP'S GIFT, BOUGHT THROUGH APPLE — the two facts the purchase path needs that the couple path does not.
 * (Owner 2026-11-04, *"they can purchase inside apple as well"*; controller 22 Nov: "delivered exactly like a web gift".)
 *
 *   · `appleGiftOnSale` — the SAME reads the web's gift buy makes (`buyVendorPapicPortfolioPack`, `for=gift`): a Papic
 *     gift rides the Papic switch and its catalogue row + tier; an Event Plus / Pro / Ultra gift its catalogue row.
 *     A Papic gift's credits must still be what its App Store name promises (`papicCreditsMatch`).
 *   · `appleGiftPurchaseRow` — the `shop_gift_purchases` row a web gift order carries, for ONE gift at the price Apple
 *     charged. Approval's `grantShopGiftPurchase` reads it and lands the gift in `shop_gift_stock_entries`, exactly as
 *     it does for a web gift; a refund's `reverseShopGiftPurchase` takes it back.
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

export type AppleGiftPurchaseRow = {
  order_id: string;
  vendor_profile_id: string;
  service_code: string;
  gift_kind: ShopGiftKind;
  quantity: 1;
  credits_each: number;
  packs_each: 1;
  bundle_code: null;
  unit_price_php: number;
  price_basis: 'list';
  created_by: string;
};

/**
 * One gift at the list price (Apple sells one at a time; the 10 + 1 bundle is a web price). A Papic gift's credits are
 * the product's own (`papicCreditsMatch` held them to the tier before Apple's sheet opened); an Event Plus / Pro / Ultra
 * gift is one unit — as `fetchShopGiftUnlockRows` counts it on the web.
 */
export function appleGiftPurchaseRow(input: {
  orderId: string;
  vendorProfileId: string;
  userId: string;
  product: IapSupplierGiftProduct;
  chargedPhp: number;
}): AppleGiftPurchaseRow | null {
  const kind = shopGiftKindOf(input.product.serviceKey);
  if (!kind) return null;
  const credits = kind === 'papic' ? input.product.credits : 1;
  if (!credits || credits <= 0 || !(input.chargedPhp > 0)) return null;
  return {
    order_id: input.orderId,
    vendor_profile_id: input.vendorProfileId,
    service_code: input.product.serviceKey,
    gift_kind: kind,
    quantity: 1,
    credits_each: credits,
    packs_each: 1,
    bundle_code: null,
    unit_price_php: input.chargedPhp,
    price_basis: 'list',
    created_by: input.userId,
  };
}
