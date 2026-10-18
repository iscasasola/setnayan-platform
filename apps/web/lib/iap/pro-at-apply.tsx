'use client';

/**
 * 🍎 EVENT HUB PRO AT ✓ APPLY, THROUGH APPLE — the kit the Maker's draft bar
 * loads LAZILY, only when the iPhone app may sell Pro and the Apply sheet opens
 * with Pro effects in it (owner 2026-10-18, ruling 2). Everything Apple-shaped
 * the sheet shows is drawn HERE (`appleProParts`) and only placed by
 * apply-pro-sheet.tsx, so the Maker's first load carries none of it
 * (scripts/check-maker-js-budget.mjs).
 *
 * Prototype `in_app_purchase_screens_2026-10-17_fable.html`: frame 1 (Unlock
 * Pro and Apply · Apple's price · two lines of fine print), 6 (Event Hub Pro is
 * on — said only after OUR server verified), 7 (switching it on), 8 (nothing
 * was charged), 9 (Apple couldn't — the button stays).
 */
import { useEffect, useRef, useState } from 'react';
import { PaidMark } from '@/app/_components/paid-mark';
import type { AppleProParts } from '@/app/dashboard/[eventId]/website/_components/apply-pro-sheet';
import { formatCount } from '@/lib/format-number';
import { iapProductForServiceKey } from './products';
import { loadAppStoreProducts, buyWithApple } from './native-store';
import { IAP_COPY, pendingLine, type IapScreen } from './iap-outcome';

const PRO = iapProductForServiceKey('COUPLE_WEBSITE_PRO');

/** StoreKit's price for Event Hub Pro — never a figure of ours. */
export async function loadProPrice(): Promise<{ state: 'ready' | 'silent'; price: string | null }> {
  if (!PRO) return { state: 'silent', price: null };
  const map = await loadAppStoreProducts([PRO.productId]);
  const price = map?.get(PRO.productId)?.displayPrice ?? null;
  return price ? { state: 'ready', price } : { state: 'silent', price: null };
}

export async function buyProWithApple(eventId: string): Promise<IapScreen> {
  if (!PRO) return { kind: 'refused', message: 'This is not available in the app right now.' };
  return buyWithApple({ eventId, productId: PRO.productId });
}

export type AppleProState = {
  price: string | null;
  priceState: 'loading' | 'ready' | 'silent';
  buying: boolean;
  /** Apply is writing (the sheet's own `pending`). */
  applying: boolean;
  screen: IapScreen | null;
  /** How many Pro effects are held — for "Your 2 Pro changes are still in your draft." */
  proCount: number;
  /** Captured at the tap: what the purchase applied, for "✓ Applied — all N changes". */
  applied: { count: number; names: string[] } | null;
  onBuy: () => void;
  onDone: () => void;
};

const LINE = 'px-4 pt-2 text-sm text-ink/70';
const PRIMARY = 'button-primary sn-press inline-flex min-h-11 w-full items-center justify-center gap-1.5 text-center disabled:opacity-60';

export function appleProParts(s: AppleProState): AppleProParts {
  const screen = s.screen;
  if (screen?.kind === 'on') {
    return {
      title: (
        <span className="inline-flex items-center gap-1.5">
          Event Hub Pro is on
          <PaidMark state="unlocked" bare label="Event Hub Pro" size="xs" />
        </span>
      ),
      body: (
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3 text-sm text-ink/70" data-apple-pro-on="">
          <p>For this event, and everyone on it.</p>
          {s.applied ? (
            <p className="mt-1 font-semibold text-ink">
              ✓ Applied — {s.applied.count === 1 ? 'your change' : `all ${formatCount(s.applied.count)} changes`}
              {s.applied.names.length > 0 ? `, including ${s.applied.names.slice(0, 2).join(' and ')}` : ''}.
            </p>
          ) : null}
        </div>
      ),
      primary: (
        <button type="button" onClick={s.onDone} className="button-primary sn-press min-h-11 w-full">
          Done
        </button>
      ),
      footer: <p className="text-center text-xs text-ink/60">{IAP_COPY.receipt}</p>,
    };
  }
  if (screen?.kind === 'pending') {
    return {
      title: IAP_COPY.pendingTitle,
      body: (
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3 text-sm text-ink/70" data-apple-pro-pending="">
          <p>{screen.askToBuy ? IAP_COPY.askToBuy : pendingLine('Event Hub Pro', false)}</p>
          <p className="mt-2">{IAP_COPY.pendingRestore}</p>
        </div>
      ),
      primary: (
        <button type="button" onClick={s.onDone} className="button-primary sn-press min-h-11 w-full">
          OK
        </button>
      ),
    };
  }
  const lead =
    screen?.kind === 'cancelled' ? (
      <p className={LINE} role="status" data-apple-cancelled="">
        {IAP_COPY.cancelled} Your{' '}
        {s.proCount === 1 ? 'Pro change is' : `${formatCount(s.proCount)} Pro changes are`} still in your draft.
      </p>
    ) : screen?.kind === 'failed' ? (
      <div className={LINE} role="alert" data-apple-failed="">
        <p>{IAP_COPY.failedLead}</p>
        <p className="mt-1">{IAP_COPY.failedNext}</p>
      </div>
    ) : screen?.kind === 'refused' ? (
      <p className={LINE} role="alert" data-apple-refused="">
        {screen.message}
      </p>
    ) : s.priceState === 'silent' ? (
      <p className={LINE} role="status" data-apple-silent="">
        {IAP_COPY.storeSilent}
      </p>
    ) : null;
  return {
    lead,
    primary: (
      <button
        type="button"
        disabled={s.applying || s.buying || !s.price}
        onClick={s.onBuy}
        data-apple-pro-unlock=""
        className={PRIMARY}
      >
        {s.buying
          ? 'Opening the App Store…'
          : `${screen?.kind === 'failed' ? 'Try again' : 'Unlock Pro and Apply'}${s.price ? ` · ${s.price}` : ''}`}
      </button>
    ),
    footer: (
      <p className="text-center text-xs text-ink/60" data-apple-fine-print="">
        One unlock for this event — it covers everyone on it.
        <br />
        {IAP_COPY.billedByApple}
      </p>
    ),
  };
}

/**
 * The Apply sheet's Apple DRIVER — the default export the draft bar loads with
 * `React.lazy` while its sheet is open with Pro in it. It owns StoreKit's price,
 * the purchase and its outcome, and hands the sheet its pieces (`onParts`);
 * it draws nothing itself. When OUR server says Pro is on it asks the bar to
 * Apply (`onApply`) — the held ◆ changes go live in the same tap ("KEEP,
 * MARKED", 2026-10-08).
 */
export default function AppleProDriver({
  eventId,
  applying,
  proCount,
  changeCount,
  names,
  onParts,
  onApply,
  onFinish,
}: {
  eventId: string;
  applying: boolean;
  proCount: number;
  changeCount: number;
  names: string[];
  onParts: (parts: AppleProParts) => void;
  onApply: () => void;
  onFinish: () => void;
}) {
  const [price, setPrice] = useState<{ state: 'loading' | 'ready' | 'silent'; price: string | null }>({ state: 'loading', price: null });
  const [buying, setBuying] = useState(false);
  const [screen, setScreen] = useState<IapScreen | null>(null);
  const [applied, setApplied] = useState<{ count: number; names: string[] } | null>(null);
  /* The bar hands fresh closures every render; read them through a ref so the
     pieces are rebuilt only when what they SHOW changes (no render loop). */
  const latest = useRef({ changeCount, names, onApply, onFinish });
  latest.current = { changeCount, names, onApply, onFinish };

  useEffect(() => {
    let alive = true;
    void loadProPrice().then((p) => {
      if (alive) setPrice(p);
    });
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    onParts(
      appleProParts({
        price: price.price,
        priceState: price.state,
        buying,
        applying,
        screen,
        proCount,
        applied,
        onBuy: () => {
          if (buying) return;
          setBuying(true);
          setScreen(null);
          setApplied({ count: latest.current.changeCount, names: latest.current.names });
          void buyProWithApple(eventId).then((s) => {
            setBuying(false);
            setScreen(s);
            if (s.kind === 'on') latest.current.onApply();
          });
        },
        onDone: () => latest.current.onFinish(),
      }),
    );
  }, [price, buying, applying, screen, proCount, applied, eventId, onParts]);

  return null;
}
