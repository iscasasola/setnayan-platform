'use client';

import { IapGiftBuy } from '@/app/_components/iap/iap-gift-buy';
import { IAP_COPY } from '@/lib/iap/iap-outcome';
import { iapSupplierGiftProductForCode } from '@/lib/iap/products';
import { bundlePaidCount, type AppleCartLine } from '@/lib/iap/apple-gift-lines';
import { formatCount } from '@/lib/format-number';
import type { ShopGiftBundle, ShopGiftPack } from '@/lib/shop-gifts';
import { bundleShape } from './gift-store-copy';

/**
 * 💝 THE GIFT STORE INSIDE THE IPHONE APP — the pieces that differ from the web store (owner 2026-11-22: the cart pays
 * LINE BY LINE, one Apple purchase per line). Everything else — the tickets, the − n + rows, the 10 + 1 bundles, the
 * "Added to your order" toast — is the web store's own (`gift-store.tsx`), drawn with these swapped in:
 *
 *   · `appleSingleNote` / `appleBundleNote` — a row's price line: Apple's `displayPrice` (StoreKit's, for this
 *     storefront) and never the catalogue's ₱;
 *   · `AppleGiftCartFoot` — instead of "Buy now · ₱total" into BDO: every line of the cart, each with its OWN Apple
 *     purchase (`IapGiftBuy`). No money ceiling: Apple charges each line by itself.
 *
 * 🔒 Nothing in this file prints a peso figure of ours or names a web rail — `a-shop-gift-is-bought-like-a-web-gift.test.ts`.
 */

/** Apple's price for ONE of each gift, by its pack code (StoreKit `displayPrice`). */
export type AppleGiftPrices = ReadonlyMap<string, string>;

const WAITING = 'Price from Apple…';

/** The words on an in-app cart line and its ticket — Apple's quantity, never a price. */
export const GIFT_LINE_BY_LINE = 'Each line is its own Apple payment.';

export function appleSingleNote(pack: ShopGiftPack, prices: AppleGiftPrices): string {
  const p = prices.get(pack.code);
  return p ? `${p} each` : WAITING;
}

export function appleBundleNote(b: ShopGiftBundle, prices: AppleGiftPrices): string {
  const p = prices.get(b.pack.code);
  const paid = bundlePaidCount(b);
  return p ? `${formatCount(paid)} × ${p} · get ${formatCount(b.quantity)}` : WAITING;
}

/** The ticket sheet's two price lines in the app: one gift, and the 10 + 1 bundle (bought as 10). */
export function appleSheetPrices(
  pack: ShopGiftPack,
  bundle: ShopGiftBundle | null,
  prices: AppleGiftPrices,
): { one: string; many: string | null } {
  return { one: appleSingleNote(pack, prices), many: bundle ? appleBundleNote(bundle, prices) : null };
}

function lineTitle(l: AppleCartLine): string {
  if (!l.bundle) return `${l.pack.title} × ${formatCount(l.qty)}`;
  const label = bundleShape(l.bundle).label;
  return l.qty > 1 ? `${l.pack.title} · ${label} × ${formatCount(l.qty)}` : `${l.pack.title} · ${label}`;
}

export function AppleGiftCartFoot({
  lines,
  prices,
  silent,
  onSettled,
}: {
  lines: readonly AppleCartLine[];
  prices: AppleGiftPrices;
  /** StoreKit did not answer: the buttons stay off and the foot says so. */
  silent: boolean;
  onSettled: (code: string) => void;
}) {
  return (
    <div className="border-t border-ink/10 bg-frame px-4 pb-[calc(12px+env(safe-area-inset-bottom,0px))] pt-2" data-gift-cart-bar="" data-gift-cart-apple="">
      {lines.length === 0 ? (
        <p className="py-2 text-center text-[14px] font-semibold text-ink/55" data-gift-cart-count="">
          Nothing picked yet
        </p>
      ) : (
        <div className="max-h-[46vh] divide-y divide-ink/10 overflow-y-auto">
          {lines.map((l) => {
            const product = iapSupplierGiftProductForCode(l.pack.code);
            return product ? (
              <IapGiftBuy
                key={l.code}
                productId={product.productId}
                quantity={l.appleQuantity}
                title={lineTitle(l)}
                price={prices.get(l.pack.code) ?? null}
                onSettled={() => onSettled(l.code)}
              />
            ) : null;
          })}
        </div>
      )}
      {silent ? (
        <p className="mt-1.5 text-center text-[13px] text-ink/70" role="status" data-iap-silent="">
          {IAP_COPY.storeSilent}
        </p>
      ) : null}
      <p className="mt-1.5 text-center text-[12.5px] text-ink/60" data-gift-cart-limit="">
        {GIFT_LINE_BY_LINE} {IAP_COPY.billedByApple}
      </p>
    </div>
  );
}
