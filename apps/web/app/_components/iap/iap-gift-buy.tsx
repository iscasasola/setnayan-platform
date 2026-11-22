'use client';

import { useState } from 'react';
import { ShoppingBag } from 'lucide-react';
import { iapSupplierGiftProductById } from '@/lib/iap/products';
import { buyWithApple } from '@/lib/iap/native-store';
import { useAppStorePrices } from '@/lib/iap/use-app-store-prices';
import { IAP_COPY, type IapScreen } from '@/lib/iap/iap-outcome';

/**
 * 💝 A SHOP'S GIFT, BOUGHT THROUGH APPLE — the pay button of the gift ticket sheet inside the iPhone app (owner
 * 2026-11-04, *"they can purchase inside apple as well"*). Same sheet, same picture, same words: only Add 1 / Add 10 + 1
 * (the web's cart, paid into BDO) is swapped for ONE Apple purchase of ONE gift. The gift lands in the shop's gift
 * stock exactly like a web gift (`lib/iap/supplier-gift.server.ts`).
 *
 * Mounted ONLY where `getIapGate().iap` is true (`ShopGiftsSectionData.appleGifts`). It shows StoreKit's
 * `displayPrice` and never a figure of ours; a product StoreKit did not return leaves the button off with no price.
 * After Apple's sheet it says the one true outcome. Once the gift is in, `confirmAppStorePurchase` revalidates the
 * gifts page, so "You have N available" redraws from the stock itself.
 */

export const GIFT_ON_LINE = 'Added to your gifts. Give it on a quote or when you agree to a booking.';
export const GIFT_PENDING_LINE = 'Apple confirmed your purchase. We’re adding it to your gifts now — it usually takes a moment.';
export const GIFT_PENDING_NEXT = 'If it’s not in your gifts in a few minutes, open this page again. You will not be charged twice.';
export const GIFT_ONE_AT_A_TIME = 'One gift at a time in the app.';

export function IapGiftBuy({ productId }: { productId: string }) {
  const product = iapSupplierGiftProductById(productId);
  const prices = useAppStorePrices(product ? [product.productId] : [], true);
  const price = product ? (prices.products.get(product.productId)?.displayPrice ?? null) : null;
  const [buying, setBuying] = useState(false);
  const [screen, setScreen] = useState<IapScreen | null>(null);

  if (!product) return null;

  const buy = () => {
    if (buying || !price) return;
    setBuying(true);
    setScreen(null);
    void buyWithApple({ productId: product.productId }).then((s) => {
      setBuying(false);
      setScreen(s);
    });
  };

  return (
    <div className="mt-3 text-center" data-iap-gift-buy={product.productId}>
      {screen?.kind === 'on' ? (
        <>
          <p className="text-[14px] text-ink/80" role="status" data-iap-gift-on="">
            {GIFT_ON_LINE}
          </p>
          <p className="mt-1 text-[12px] text-ink/60">{IAP_COPY.receipt}</p>
        </>
      ) : screen?.kind === 'pending' ? (
        <div className="text-[14px] text-ink/80" role="status" data-iap-gift-pending="">
          <p>{screen.askToBuy ? IAP_COPY.askToBuy : GIFT_PENDING_LINE}</p>
          <p className="mt-1 text-[12.5px] text-ink/60">{GIFT_PENDING_NEXT}</p>
        </div>
      ) : (
        <>
          {screen?.kind === 'cancelled' ? (
            <p className="mb-2 text-[13.5px] text-ink/70" role="status" data-iap-cancelled="">
              {IAP_COPY.cancelled}
            </p>
          ) : screen?.kind === 'failed' ? (
            <div className="mb-2 text-[13.5px] text-ink/70" role="alert" data-iap-failed="">
              <p>{IAP_COPY.failedLead}</p>
              <p className="mt-1">{IAP_COPY.failedNext}</p>
            </div>
          ) : screen?.kind === 'refused' ? (
            <p className="mb-2 text-[13.5px] text-ink/70" role="alert" data-iap-refused="">
              {screen.message}
            </p>
          ) : null}
          {prices.state === 'silent' ? (
            <p className="mb-2 text-[13.5px] text-ink/70" role="status" data-iap-silent="">
              {IAP_COPY.storeSilent}
            </p>
          ) : null}
          <button
            type="button"
            onClick={buy}
            disabled={buying || !price}
            data-testid="gift-sheet-buy-apple"
            className="ab ab-brand ab-main inline-flex min-h-[56px] w-full items-center justify-center gap-2 rounded-xl disabled:opacity-60"
          >
            <ShoppingBag aria-hidden className="h-4 w-4" strokeWidth={1.9} />
            {buying ? 'Opening the App Store…' : `${screen?.kind === 'failed' ? 'Try again' : 'Buy 1'}${price ? ` · ${price}` : ''}`}
          </button>
          <p className="mt-1.5 text-[12px] text-ink/60">
            {IAP_COPY.billedByApple} {GIFT_ONE_AT_A_TIME}
          </p>
        </>
      )}
    </div>
  );
}
