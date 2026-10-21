'use client';

import { useCallback, useId, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Plus, X } from 'lucide-react';
import { ActionButton } from '@/components/action-button';
import { Sheet } from '@/app/_components/sheet';
import { CreditStepper, type StepperRung } from '@/app/dashboard/[eventId]/studio/papic/_components/credit-stepper';
import { IAP_PAPIC_PRODUCTS } from '@/lib/iap/products';
import { buyWithApple } from '@/lib/iap/native-store';
import { useAppStorePrices } from '@/lib/iap/use-app-store-prices';
import { IAP_COPY, pendingLine, type IapScreen } from '@/lib/iap/iap-outcome';

/**
 * 🍎 PAPIC · ADD CREDITS — IN THE iPHONE APP (prototype
 * `in_app_purchase_screens_2026-10-17_fable.html` frame 3; owner 2026-10-18,
 * rulings 1 and 5).
 *
 * The SHIPPED Buy more sheet (`papic-buy-sheet.tsx` + `papic-buy-form.tsx`),
 * redrawn with exactly its delta: "Add credits", "You have N credits now.", the
 * − / + stepper and "After this" are unchanged; the stepper walks the FIVE Apple
 * packs (100 · 500 · 1,000 · 5,000 · 10,000) at StoreKit's prices; "Continue to
 * payment" becomes "Buy · ₱" and opens Apple's sheet. No web price, no GCash.
 * After Apple's sheet the sheet says the one true outcome (frames 7 · 8 · 9).
 */
export function IapPapicSheet({
  eventId,
  left,
  main = false,
}: {
  eventId: string;
  left: number | null;
  /** The Papic page's band: Buy more is that page's one main button (the web sheet's own `main`). */
  main?: boolean;
}) {
  const headingId = useId();
  const [open, setOpen] = useState(false);
  const prices = useAppStorePrices(
    IAP_PAPIC_PRODUCTS.map((p) => p.productId),
    open,
  );
  // Only the packs StoreKit actually priced — a pack Apple did not return is not offered.
  const rungs: StepperRung[] = useMemo(
    () =>
      IAP_PAPIC_PRODUCTS.flatMap((p) => {
        const sk = prices.products.get(p.productId);
        return sk && p.credits
          ? [{ serviceCode: p.productId, points: p.credits, pricePhp: 0, discountPercent: null, priceLabel: sk.displayPrice }]
          : [];
      }),
    [prices.products],
  );
  const [rung, setRung] = useState<StepperRung | null>(null);
  const onRung = useCallback((r: StepperRung) => setRung(r), []);
  const [buying, setBuying] = useState(false);
  const [screen, setScreen] = useState<IapScreen | null>(null);
  const [bought, setBought] = useState<number | null>(null);

  const buy = () => {
    if (!rung || buying) return;
    setBuying(true);
    setScreen(null);
    setBought(rung.points);
    void buyWithApple({ eventId, productId: rung.serviceCode }).then((s) => {
      setBuying(false);
      setScreen(s);
    });
  };
  const close = () => {
    if (buying) return;
    setOpen(false);
    setScreen(null);
  };
  const credits = (n: number) => `${n.toLocaleString('en-PH')} credits`;

  const body =
    screen?.kind === 'on' ? (
      <div data-iap-papic-on="">
        <p className="text-sm text-ink/70">
          {bought ? `${credits(bought)} are on this event.` : 'Your credits are on this event.'}
        </p>
        <div className="mt-3.5">
          <ActionButton tone="brand" main icon={<X aria-hidden strokeWidth={1.9} />} label="Done" onClick={close} />
        </div>
        <p className="mt-1.5 text-center text-xs text-ink/60">{IAP_COPY.receipt}</p>
      </div>
    ) : screen?.kind === 'pending' ? (
      <div data-iap-papic-pending="">
        <p className="text-[17px] font-semibold text-ink">{IAP_COPY.pendingTitle}</p>
        <p className="mt-1 text-sm text-ink/70">
          {screen.askToBuy ? IAP_COPY.askToBuy : pendingLine(bought ? credits(bought) : 'your credits', true)}
        </p>
        <p className="mt-2 text-sm text-ink/70">{IAP_COPY.pendingRestore}</p>
        <div className="mt-3.5">
          <ActionButton tone="brand" main icon={<X aria-hidden strokeWidth={1.9} />} label="OK" onClick={close} />
        </div>
      </div>
    ) : (
      <>
        {screen?.kind === 'cancelled' ? (
          <p className="mb-3 text-sm text-ink/70" role="status" data-iap-cancelled="">
            {IAP_COPY.cancelled}
          </p>
        ) : screen?.kind === 'failed' ? (
          <div className="mb-3 text-sm text-ink/70" role="alert" data-iap-failed="">
            <p>{IAP_COPY.failedLead}</p>
            <p className="mt-1">{IAP_COPY.failedNext}</p>
          </div>
        ) : screen?.kind === 'refused' ? (
          <p className="mb-3 text-sm text-ink/70" role="alert" data-iap-refused="">
            {screen.message}
          </p>
        ) : null}
        {prices.state === 'loading' ? (
          <p className="sg-step" aria-live="polite">
            Loading sizes…
          </p>
        ) : rungs.length === 0 ? (
          <p className="text-sm text-ink/70" role="status" data-iap-silent="">
            {IAP_COPY.storeSilent}
          </p>
        ) : (
          <>
            <CreditStepper rungs={rungs} onRungChange={onRung} />
            {left !== null && rung ? (
              <div className="sg-after" data-papic-after="">
                <span>After this</span>
                <b>{credits(left + rung.points)}</b>
              </div>
            ) : null}
            <div className="mt-3.5">
              <button
                type="button"
                onClick={buy}
                disabled={!rung || buying}
                data-iap-papic-buy=""
                className="ab ab-brand ab-main sg-pay inline-flex min-h-11 w-full items-center justify-center disabled:opacity-60"
              >
                {buying
                  ? 'Opening the App Store…'
                  : `${screen?.kind === 'failed' ? 'Try again' : 'Buy'}${rung?.priceLabel ? ` · ${rung.priceLabel}` : ''}`}
              </button>
              <p className="sg-step">Credits land on this event the moment Apple confirms.</p>
            </div>
          </>
        )}
        <div className="mt-1.5 text-center">
          <ActionButton tone="neutral" quiet icon={<X aria-hidden="true" strokeWidth={1.9} />} label="Not now" onClick={close} />
        </div>
      </>
    );

  const sheet = open ? (
    <Sheet open onClose={close} labelledById={headingId} rise>
      <div className="px-4 pb-4 pt-3.5" data-iap-papic-sheet="">
        <h3 id={headingId} className="text-[19px] font-semibold tracking-tight text-ink">
          Add credits
        </h3>
        {screen?.kind === 'on' || screen?.kind === 'pending' ? null : (
          <p className="mb-3.5 text-sm text-ink/60">
            {left !== null ? `You have ${left.toLocaleString('en-PH')} credits now.` : 'Credits land once Apple confirms.'}
          </p>
        )}
        {body}
      </div>
    </Sheet>
  ) : null;

  return (
    <>
      <ActionButton
        tone="brand"
        main={main}
        icon={<Plus aria-hidden="true" strokeWidth={1.9} />}
        label="Buy more"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-expanded={open}
        data-testid="iap-papic-buy-more"
      />
      {sheet && typeof document !== 'undefined' ? createPortal(sheet, document.body) : null}
    </>
  );
}
