'use client';

import { useState } from 'react';
import { ShoppingBag } from 'lucide-react';
import { iapSupplierGiftProductById } from '@/lib/iap/products';
import { buyWithApple } from '@/lib/iap/native-store';
import { IAP_COPY, type IapScreen } from '@/lib/iap/iap-outcome';

/**
 * 💝 ONE LINE OF A SHOP'S GIFT CART, PAID THROUGH APPLE — inside the iPhone app (owner 2026-11-04, *"they can purchase
 * inside apple as well"*; owner 2026-11-22: the cart pays LINE BY LINE, one Apple purchase per line, Face ID once per
 * line). The line is its gift bought with a quantity (a 10 + 1 bundle = 10, and 11 land). The gift lands in the shop's
 * gift stock exactly like a web gift (`lib/iap/supplier-gift.server.ts`).
 *
 * Mounted ONLY where the gift store is drawn in the app (`ShopGiftsSectionData.appleGifts`: the three-part gate AND a
 * build that passes a quantity). It shows StoreKit's `displayPrice` (handed down, read once for the whole store) and
 * never a figure of ours; with no price the button stays off. After Apple's sheet it says the one true outcome, and
 * tells the cart the line is settled (`onSettled`) so it leaves the cart when the store closes.
 */

export const GIFT_ON_LINE = 'Added to your gifts. Give them on a quote or when you agree to a booking.';
export const GIFT_PENDING_LINE = 'Apple confirmed your purchase. We’re adding it to your gifts now — it usually takes a moment.';
export const GIFT_PENDING_NEXT = 'If it’s not in your gifts in a few minutes, open this page again. You will not be charged twice.';

export function IapGiftBuy({
  productId,
  quantity,
  title,
  price,
  onSettled,
}: {
  productId: string;
  /** How many of the gift this ONE Apple purchase buys (1–10). */
  quantity: number;
  /** The line as the shop picked it — "Papic 150 × 3", "Papic 150 · 10 + 1". */
  title: string;
  /** StoreKit's `displayPrice` for ONE of the gift; null ⇒ Apple has not answered and the button stays off. */
  price: string | null;
  onSettled?: () => void;
}) {
  const product = iapSupplierGiftProductById(productId);
  const [buying, setBuying] = useState(false);
  const [screen, setScreen] = useState<IapScreen | null>(null);

  if (!product) return null;

  const buy = () => {
    if (buying || !price) return;
    setBuying(true);
    setScreen(null);
    void buyWithApple({ productId: product.productId, quantity }).then((s) => {
      setBuying(false);
      setScreen(s);
      if (s.kind === 'on' || s.kind === 'pending') onSettled?.();
    });
  };
  const each = price ? (quantity > 1 ? ` · ${quantity} × ${price}` : ` · ${price}`) : '';

  return (
    <div className="py-2.5 text-left" data-iap-gift-buy={product.productId} data-iap-gift-quantity={quantity}>
      <b className="block text-[14.5px] text-ink">{title}</b>
      {screen?.kind === 'on' ? (
        <>
          <p className="mt-1 text-[14px] text-ink/80" role="status" data-iap-gift-on="">
            ✓ {GIFT_ON_LINE}
          </p>
          <p className="mt-0.5 text-[12px] text-ink/60">{IAP_COPY.receipt}</p>
        </>
      ) : screen?.kind === 'pending' ? (
        <div className="mt-1 text-[14px] text-ink/80" role="status" data-iap-gift-pending="">
          <p>{screen.askToBuy ? IAP_COPY.askToBuy : GIFT_PENDING_LINE}</p>
          <p className="mt-1 text-[12.5px] text-ink/60">{GIFT_PENDING_NEXT}</p>
        </div>
      ) : (
        <>
          {screen?.kind === 'cancelled' ? (
            <p className="mt-1 text-[13.5px] text-ink/70" role="status" data-iap-cancelled="">
              {IAP_COPY.cancelled}
            </p>
          ) : screen?.kind === 'failed' ? (
            <div className="mt-1 text-[13.5px] text-ink/70" role="alert" data-iap-failed="">
              <p>{IAP_COPY.failedLead}</p>
              <p className="mt-1">{IAP_COPY.failedNext}</p>
            </div>
          ) : screen?.kind === 'refused' ? (
            <p className="mt-1 text-[13.5px] text-ink/70" role="alert" data-iap-refused="">
              {screen.message}
            </p>
          ) : null}
          <button
            type="button"
            onClick={buy}
            disabled={buying || !price}
            data-testid="gift-cart-buy-apple"
            className="ab ab-brand ab-main mt-2 inline-flex min-h-[52px] w-full items-center justify-center gap-2 rounded-xl disabled:opacity-60"
          >
            <ShoppingBag aria-hidden className="h-4 w-4" strokeWidth={1.9} />
            {buying ? 'Opening the App Store…' : `${screen?.kind === 'failed' ? 'Try again' : 'Buy'}${each}`}
          </button>
        </>
      )}
    </div>
  );
}
