'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { PaidMark } from '@/app/_components/paid-mark';
import { iapProductForServiceKey } from '@/lib/iap/products';
import { buyWithApple, loadAppStoreProducts } from '@/lib/iap/native-store';
import { IAP_COPY, pendingLine, type IapScreen } from '@/lib/iap/iap-outcome';

const PRO = iapProductForServiceKey('COUPLE_WEBSITE_PRO');

/**
 * 🍎 EVENT HUB PRO, BOUGHT THROUGH APPLE — the page the Maker's "Unlock Pro and
 * Apply" opens in the iPhone app (owner 2026-10-18, ruling 2: Pro is offered
 * ONLY at ✓ Apply). It plays the part the web's Pro page plays: it sells, then
 * sends the couple back to the Maker with `?apply=1`, where the held ◆ changes
 * are applied in the same tap (`unlockAndApplyOnReturn`, "KEEP, MARKED").
 *
 * Its own page — not more code in the Apply sheet — so none of StoreKit rides
 * the Maker's first load (scripts/check-maker-js-budget.mjs).
 *
 * The price is StoreKit's (`displayPrice`), never typed. Success is said only
 * after OUR server verified Apple's transaction; every other outcome says one
 * true sentence (prototype `in_app_purchase_screens_2026-10-17_fable.html`
 * frames 1 · 6 · 7 · 8 · 9).
 */
export function AppleProScreen(props: AppleProScreenProps) {
  return <AppleProEverything eventId={props.eventId} back={props.back} sample={props.sample ?? null} />;
}

type AppleProScreenProps = {
  eventId: string;
  /** The Maker (or Home) — where the couple returns. */
  back: string;
  /** DEV LAB ONLY: draw one outcome with a sample price, without StoreKit. */
  sample?: { screen: IapScreen | null; price: string | null } | null;
};

/**
 * Everything (Full Pro) — the one product the app sells for the Event Hub (owner 2026-10-26: "just have the upgrade
 * event hub pro"; the part-by-part Apple products of 2026-10-22 are retired, never attached to a version).
 */
function AppleProEverything({ eventId, back, sample }: Pick<AppleProScreenProps, 'eventId' | 'back'> & { sample: AppleProScreenProps['sample'] }) {
  const router = useRouter();
  const [price, setPrice] = useState<{ state: 'loading' | 'ready' | 'silent'; value: string | null }>(
    sample ? { state: sample.price ? 'ready' : 'silent', value: sample.price } : { state: 'loading', value: null },
  );
  const [buying, setBuying] = useState(false);
  const [screen, setScreen] = useState<IapScreen | null>(sample?.screen ?? null);

  useEffect(() => {
    if (sample || !PRO) return;
    let alive = true;
    void loadAppStoreProducts([PRO.productId]).then((map) => {
      const v = map?.get(PRO.productId)?.displayPrice ?? null;
      if (alive) setPrice(v ? { state: 'ready', value: v } : { state: 'silent', value: null });
    });
    return () => {
      alive = false;
    };
  }, [sample]);

  const buy = () => {
    if (!PRO || buying || sample) return;
    setBuying(true);
    setScreen(null);
    void buyWithApple({ eventId, productId: PRO.productId }).then((s) => {
      setBuying(false);
      setScreen(s);
    });
  };
  const sep = back.includes('?') ? '&' : '?';

  if (screen?.kind === 'on') {
    return (
      <section className="mx-auto flex w-full max-w-md flex-col gap-3 px-4 py-6" data-apple-pro-on="">
        <h1 className="inline-flex items-center gap-1.5 font-serif text-2xl text-ink">
          Event Hub Pro is on
          <PaidMark state="unlocked" bare label="Event Hub Pro" size="xs" />
        </h1>
        <p className="text-sm text-ink/70">For this event, and everyone on it.</p>
        <button type="button" onClick={() => router.push(`${back}${sep}apply=1`)} className="button-primary sn-press mt-2 min-h-11 w-full">
          Done — apply my changes
        </button>
        <p className="text-center text-xs text-ink/60">{IAP_COPY.receipt}</p>
      </section>
    );
  }
  if (screen?.kind === 'pending') {
    return (
      <section className="mx-auto flex w-full max-w-md flex-col gap-3 px-4 py-6" data-apple-pro-pending="">
        <h1 className="font-serif text-2xl text-ink">{IAP_COPY.pendingTitle}</h1>
        <p className="text-sm text-ink/70">{screen.askToBuy ? IAP_COPY.askToBuy : pendingLine('Event Hub Pro', false)}</p>
        <p className="text-sm text-ink/70">{IAP_COPY.pendingRestore}</p>
        <button type="button" onClick={() => router.push(back)} className="button-primary sn-press mt-2 min-h-11 w-full">
          OK
        </button>
      </section>
    );
  }
  return (
    <section className="mx-auto flex w-full max-w-md flex-col gap-3 px-4 py-6" data-apple-pro-buy="">
      <h1 className="inline-flex items-center gap-1.5 font-serif text-2xl text-ink">
        Event Hub Pro
        <PaidMark state="try" bare label="Event Hub Pro" size="xs" />
      </h1>
      <p className="text-sm text-ink/70">One unlock for this event — it covers everyone on it. Your Pro changes go live as soon as it is on.</p>
      {screen?.kind === 'cancelled' ? (
        <p className="text-sm text-ink/70" role="status" data-apple-cancelled="">
          {IAP_COPY.cancelled} Your Pro changes are still in your draft.
        </p>
      ) : screen?.kind === 'failed' ? (
        <div className="text-sm text-ink/70" role="alert" data-apple-failed="">
          <p>{IAP_COPY.failedLead}</p>
          <p className="mt-1">{IAP_COPY.failedNext}</p>
        </div>
      ) : screen?.kind === 'refused' ? (
        <p className="text-sm text-ink/70" role="alert" data-apple-refused="">
          {screen.message}
        </p>
      ) : price.state === 'silent' ? (
        <p className="text-sm text-ink/70" role="status" data-apple-silent="">
          {IAP_COPY.storeSilent}
        </p>
      ) : null}
      <button
        type="button"
        onClick={buy}
        disabled={buying || !price.value}
        data-apple-pro-unlock=""
        className="button-primary sn-press mt-2 inline-flex min-h-11 w-full items-center justify-center text-center disabled:opacity-60"
      >
        {buying
          ? 'Opening the App Store…'
          : `${screen?.kind === 'failed' ? 'Try again' : 'Unlock Pro and Apply'}${price.value ? ` · ${price.value}` : ''}`}
      </button>
      <p className="text-center text-xs text-ink/60">{IAP_COPY.billedByApple}</p>
      <button type="button" onClick={() => router.push(back)} className="sn-press min-h-11 w-full rounded-full text-sm font-semibold text-ink/70 hover:bg-ink/5">
        Not now
      </button>
    </section>
  );
}
