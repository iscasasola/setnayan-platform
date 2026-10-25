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
  const { parts = [], ownedNames = [] } = props;
  if (parts.length > 0) {
    return <AppleProParts eventId={props.eventId} back={props.back} parts={parts} ownedNames={ownedNames} sample={props.sample ?? null} />;
  }
  return <AppleProEverything eventId={props.eventId} back={props.back} sample={props.sample ?? null} />;
}

type AppleProScreenProps = {
  eventId: string;
  /** The Maker (or Home) — where the couple returns. */
  back: string;
  /** DEV LAB ONLY: draw one outcome with a sample price, without StoreKit. */
  sample?: { screen: IapScreen | null; price: string | null; partPrices?: Record<string, string> } | null;
  /**
   * 💎 PART BY PART (owner 2026-10-22, 1.1 flag-dark): the parts the Apply sheet asked for — each a fixed-price Apple
   * product, bought one after another in this one tap. Empty: "everything" (Full Pro), offered only while nothing is
   * owned (the page decides).
   */
  parts?: ReadonlyArray<{ name: string; productId: string }>;
  /** The parts this event already holds — named, and said to count toward Event Hub Pro (no figure). */
  ownedNames?: readonly string[];
};

/** Everything (Full Pro) — the one product, offered only while the event owns no part (the page decides). */
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

/**
 * 💎 THE PARTS, THROUGH APPLE (owner 2026-10-22; prototype frame 6) — each part at StoreKit's own price
 * (`displayPrice`, never a web figure, never a sum the app would have to invent), bought one after another in one tap:
 * "Unlock Style + Motion and Apply". The band says what is already owned and that it counts toward Event Hub Pro — no
 * figure, and never "everything for less on the web" (3.1.1). Success is said only once OUR server has verified each.
 */
function AppleProParts({
  eventId,
  back,
  parts,
  ownedNames,
  sample,
}: {
  eventId: string;
  back: string;
  parts: ReadonlyArray<{ name: string; productId: string }>;
  ownedNames: readonly string[];
  sample: { screen: IapScreen | null; price: string | null; partPrices?: Record<string, string> } | null;
}) {
  const router = useRouter();
  const [prices, setPrices] = useState<Record<string, string> | null>(sample?.partPrices ?? null);
  const [silent, setSilent] = useState(false);
  const [buying, setBuying] = useState<string | null>(null);
  const [done, setDone] = useState<string[]>([]);
  const [screen, setScreen] = useState<IapScreen | null>(sample?.screen ?? null);
  useEffect(() => {
    if (sample) return;
    let alive = true;
    void loadAppStoreProducts(parts.map((p) => p.productId)).then((map) => {
      if (!alive) return;
      const out: Record<string, string> = {};
      for (const p of parts) {
        const v = map?.get(p.productId)?.displayPrice;
        if (v) out[p.productId] = v;
      }
      if (Object.keys(out).length === parts.length) setPrices(out);
      else setSilent(true);
    });
    return () => {
      alive = false;
    };
  }, [parts, sample]);
  const left = parts.filter((p) => !done.includes(p.productId));
  const buyAll = async () => {
    if (sample || buying || !prices) return;
    setScreen(null);
    for (const p of left) {
      setBuying(p.productId);
      const s = await buyWithApple({ eventId, productId: p.productId });
      if (s.kind !== 'on') {
        setBuying(null);
        setScreen(s);
        return;
      }
      setDone((d) => [...d, p.productId]);
    }
    setBuying(null);
    setScreen({ kind: 'on' });
  };
  const sep = back.includes('?') ? '&' : '?';
  const names = parts.map((p) => p.name).join(' + ');
  if (screen?.kind === 'on') {
    return (
      <section className="mx-auto flex w-full max-w-md flex-col gap-3 px-4 py-6" data-apple-parts-on="">
        <h1 className="inline-flex items-center gap-1.5 font-serif text-2xl text-ink">
          {names} {parts.length === 1 ? 'is' : 'are'} on
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
  return (
    <section className="mx-auto flex w-full max-w-md flex-col gap-3 px-4 py-6" data-apple-parts-buy="">
      <h1 className="inline-flex items-center gap-1.5 font-serif text-2xl text-ink">
        Event Hub Pro
        <PaidMark state="try" bare label="Event Hub Pro" size="xs" />
      </h1>
      <ul className="divide-y divide-ink/10">
        {parts.map((p) => (
          <li key={p.productId} className="flex min-h-11 items-center justify-between gap-3 py-2 text-sm" data-apple-part={p.productId}>
            <span className="inline-flex items-center gap-2 font-semibold text-ink">
              {done.includes(p.productId) ? <PaidMark state="unlocked" bare label="Event Hub Pro" size="xs" /> : <PaidMark state="try" bare label="Event Hub Pro" size="xs" />}
              {p.name}
            </span>
            <span className="font-mono text-ink/80">{prices?.[p.productId] ?? ''}</span>
          </li>
        ))}
      </ul>
      {ownedNames.length > 0 ? (
        <p className="rounded-2xl bg-ink/[0.05] px-3 py-2.5 text-[13px] leading-snug text-ink/80" data-apple-parts-band="">
          You already have <strong className="text-ink">{ownedNames.join(' · ')}</strong>. Everything you unlock counts toward Event Hub Pro.
        </p>
      ) : null}
      {screen?.kind === 'cancelled' ? (
        <p className="text-sm text-ink/70" role="status">{IAP_COPY.cancelled} Your Pro changes are still in your draft.</p>
      ) : screen?.kind === 'failed' ? (
        <div className="text-sm text-ink/70" role="alert">
          <p>{IAP_COPY.failedLead}</p>
          <p className="mt-1">{IAP_COPY.failedNext}</p>
        </div>
      ) : screen?.kind === 'refused' ? (
        <p className="text-sm text-ink/70" role="alert">{screen.message}</p>
      ) : screen?.kind === 'pending' ? (
        <p className="text-sm text-ink/70" role="status">{screen.askToBuy ? IAP_COPY.askToBuy : pendingLine(names, false)}</p>
      ) : silent ? (
        <p className="text-sm text-ink/70" role="status">{IAP_COPY.storeSilent}</p>
      ) : null}
      <button
        type="button"
        onClick={() => void buyAll()}
        disabled={Boolean(buying) || !prices}
        data-apple-parts-unlock=""
        className="button-primary sn-press mt-2 inline-flex min-h-11 w-full items-center justify-center text-center disabled:opacity-60"
      >
        {buying ? 'Opening the App Store…' : `Unlock ${left.map((p) => p.name).join(' + ') || names} and Apply`}
      </button>
      <p className="text-center text-xs text-ink/60">{IAP_COPY.billedByApple}</p>
      <button type="button" onClick={() => router.push(back)} className="sn-press min-h-11 w-full rounded-full text-sm font-semibold text-ink/70 hover:bg-ink/5">
        Not now
      </button>
    </section>
  );
}
