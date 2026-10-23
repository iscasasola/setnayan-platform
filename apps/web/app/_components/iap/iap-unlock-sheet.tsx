'use client';

import { useId, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Sparkles, X } from 'lucide-react';
import { ActionButton } from '@/components/action-button';
import { Sheet } from '@/app/_components/sheet';
import { InfoTip } from '@/app/_components/info-tip';
import { iapProductById, iapProductForServiceKey } from '@/lib/iap/products';
import { buyWithApple } from '@/lib/iap/native-store';
import { useAppStorePrices } from '@/lib/iap/use-app-store-prices';
import { IAP_COPY, pendingLine, type IapScreen } from '@/lib/iap/iap-outcome';

/**
 * 🍎 ONE APPLE DOOR FOR AN EVENT'S UNLOCK — Setnayan AI, Music Maker, Patiktok, Thank You and the Mood Board pack
 * (owner 2026-10-23, "five more Apple products"). The Live Watch sheet's look and order (`iap-live-watch-sheet.tsx`,
 * prototype `in_app_purchase_screens_2026-10-17_fable.html` frame 4), with that sheet's Live-Watch-only notices taken
 * out: a title, ONE short line (anything more lives in the ⓘ), Apple's price on the button, "Billed by Apple".
 *
 * Mounted ONLY where `getIapGate().iap` is true — each page swaps its existing pay step for this and nothing else.
 * It shows StoreKit's `displayPrice` and never a figure of ours; a product StoreKit did not return leaves the button
 * disabled with no price, never a web price. After Apple's sheet it says the one true outcome (frames 6–9), and once
 * the item is on, the page already re-renders as owned: `confirmAppStorePurchase` revalidates the event's layout
 * (one save, one render — no `router.refresh()` here, as in the Live Watch sheet).
 */
export function IapUnlockSheet({
  eventId,
  serviceKey,
  productId,
  name,
  line,
  info,
  triggerLabel,
  triggerTestId,
  buyVerb = 'Add',
  onLine = 'For this event, and everyone on it.',
  plural = false,
  triggerClassName,
}: {
  eventId: string;
  /** The catalogue code the page already sells (`orders.service_key`) — its Apple product is looked up, never typed. */
  serviceKey: string;
  /**
   * ✦ The exact product, when one code has several (Setnayan AI: one per web tier, picked by the server from the
   * event's tier). Must sell `serviceKey`, or nothing is drawn.
   */
  productId?: string;
  /** What the sheet is titled, and what "is on" afterwards. */
  name: string;
  /** The one visible line under the title. */
  line: string;
  /** Everything else — inside the ⓘ. */
  info?: ReactNode;
  /** The page's own button words, unchanged ("Unlock Setnayan AI", "Save & share"…), without a price. */
  triggerLabel: string;
  triggerTestId?: string;
  /** "Add Music Maker", "Buy Mood Board · 50 renders"… */
  buyVerb?: string;
  /** Said once it is on. */
  onLine?: string;
  /** A pack of credits: "adding them to this event" while Apple's answer is being switched on. */
  plural?: boolean;
  /** The page's own trigger look, so the door sits where the web's did. Default: the brand button. */
  triggerClassName?: string;
}) {
  const picked = productId ? iapProductById(productId) : iapProductForServiceKey(serviceKey);
  const product = picked && picked.serviceKey === serviceKey ? picked : null;
  const headingId = useId();
  const [open, setOpen] = useState(false);
  const prices = useAppStorePrices(product ? [product.productId] : [], open);
  const price = product ? (prices.products.get(product.productId)?.displayPrice ?? null) : null;
  const [buying, setBuying] = useState(false);
  const [screen, setScreen] = useState<IapScreen | null>(null);

  if (!product) return null;

  const buy = () => {
    if (buying || !price) return;
    setBuying(true);
    setScreen(null);
    void buyWithApple({ eventId, productId: product.productId }).then((s) => {
      setBuying(false);
      setScreen(s);
    });
  };
  const close = () => {
    if (buying) return;
    setOpen(false);
    setScreen(null);
  };

  const sheet = open ? (
    <Sheet open onClose={close} labelledById={headingId} rise>
      <div className="px-4 pb-4 pt-3.5" data-iap-unlock-sheet={product.productId}>
        {screen?.kind === 'on' || screen?.kind === 'pending' || !info ? (
          <h3 id={headingId} className="text-[19px] font-semibold tracking-tight text-ink">
            {screen?.kind === 'on' ? `${name} is on` : screen?.kind === 'pending' ? IAP_COPY.pendingTitle : name}
          </h3>
        ) : (
          <InfoTip
            label={name}
            labelAs="h3"
            labelId={headingId}
            labelClassName="text-[19px] font-semibold tracking-tight text-ink"
            align="start"
          >
            {info}
          </InfoTip>
        )}
        {screen?.kind === 'on' ? (
          <>
            <p className="mt-1 text-sm text-ink/70">{onLine}</p>
            <div className="mt-3.5">
              <ActionButton tone="brand" main icon={<X aria-hidden strokeWidth={1.9} />} label="Done" onClick={close} />
            </div>
            <p className="mt-1.5 text-center text-xs text-ink/60">{IAP_COPY.receipt}</p>
          </>
        ) : screen?.kind === 'pending' ? (
          <>
            <p className="mt-1 text-sm text-ink/70">{screen.askToBuy ? IAP_COPY.askToBuy : pendingLine(name, plural)}</p>
            <p className="mt-2 text-sm text-ink/70">{IAP_COPY.pendingRestore}</p>
            <div className="mt-3.5">
              <ActionButton tone="brand" main icon={<X aria-hidden strokeWidth={1.9} />} label="OK" onClick={close} />
            </div>
          </>
        ) : (
          <>
            {screen?.kind === 'cancelled' ? (
              <p className="mt-1 text-sm text-ink/70" role="status" data-iap-cancelled="">
                {IAP_COPY.cancelled}
              </p>
            ) : screen?.kind === 'failed' ? (
              <div className="mt-1 text-sm text-ink/70" role="alert" data-iap-failed="">
                <p>{IAP_COPY.failedLead}</p>
                <p className="mt-1">{IAP_COPY.failedNext}</p>
              </div>
            ) : screen?.kind === 'refused' ? (
              <p className="mt-1 text-sm text-ink/70" role="alert" data-iap-refused="">
                {screen.message}
              </p>
            ) : (
              <p className="mt-1 text-sm text-ink/70">{line}</p>
            )}
            {prices.state === 'silent' ? (
              <p className="mt-3 text-sm text-ink/70" role="status" data-iap-silent="">
                {IAP_COPY.storeSilent}
              </p>
            ) : null}
            <div className="mt-3.5">
              <button
                type="button"
                onClick={buy}
                disabled={buying || !price}
                data-iap-unlock-buy=""
                className="ab ab-brand ab-main inline-flex min-h-11 w-full items-center justify-center disabled:opacity-60"
              >
                {buying
                  ? 'Opening the App Store…'
                  : `${screen?.kind === 'failed' ? 'Try again' : `${buyVerb} ${name}`}${price ? ` · ${price}` : ''}`}
              </button>
              <p className="mt-1.5 text-center text-xs text-ink/60">{IAP_COPY.billedByApple}</p>
            </div>
            <div className="mt-1.5 text-center">
              <ActionButton tone="neutral" quiet icon={<X aria-hidden="true" strokeWidth={1.9} />} label="Not now" onClick={close} />
            </div>
          </>
        )}
      </div>
    </Sheet>
  ) : null;

  return (
    <>
      {triggerClassName ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-haspopup="dialog"
          aria-expanded={open}
          data-testid={triggerTestId}
          className={triggerClassName}
        >
          {triggerLabel}
        </button>
      ) : (
        <ActionButton
          tone="brand"
          icon={<Sparkles aria-hidden="true" strokeWidth={1.9} />}
          label={triggerLabel}
          onClick={() => setOpen(true)}
          aria-haspopup="dialog"
          aria-expanded={open}
          data-testid={triggerTestId}
        />
      )}
      {sheet && typeof document !== 'undefined' ? createPortal(sheet, document.body) : null}
    </>
  );
}
