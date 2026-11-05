'use client';

import { useId, useState } from 'react';
import { createPortal } from 'react-dom';
import { Radio, X } from 'lucide-react';
import { ActionButton } from '@/components/action-button';
import { Sheet } from '@/app/_components/sheet';
import { iapProductForServiceKey } from '@/lib/iap/products';
import { buyWithApple } from '@/lib/iap/native-store';
import { useAppStorePrices } from '@/lib/iap/use-app-store-prices';
import { IAP_COPY, pendingLine, type IapScreen } from '@/lib/iap/iap-outcome';
import { ENCODER_BUY_NOTICE, MUSIC_RIGHTS_NOTICE, YOUTUBE_READY_NOTICE } from '@/lib/live-studio-readiness';
import { setYoutubeLiveReadyAck } from '@/app/dashboard/[eventId]/studio/live-studio-control/actions';

const LIVE_WATCH = iapProductForServiceKey('LIVE_STUDIO');

/**
 * 🍎 LIVE WATCH · ACTIVATE — IN THE iPHONE APP (prototype
 * `in_app_purchase_screens_2026-10-17_fable.html` frame 4; owner 2026-10-18,
 * rulings 1 and 3: one purchase for THIS event).
 *
 * The shipped plan sheet's facts as `live-studio-control/page.tsx` mounts them —
 * the YouTube, laptop and music notices, unchanged, and the AFFIRMATIVE tick box
 * that gates the button (owner 2026-09-02; consent-is-affirmative.test.ts) —
 * minus the one notice that no longer applies here: "we check every payment by
 * hand" (`LEAD_TIME_NOTICE`). Apple confirms at once. The button opens Apple's
 * sheet at StoreKit's price.
 */
export function IapLiveWatchSheet({
  eventId,
  askReady,
}: {
  eventId: string;
  /** Ask the tick box — only while this person has never confirmed it (`users.youtube_live_ready_ack_at`). */
  askReady: boolean;
}) {
  const headingId = useId();
  const [open, setOpen] = useState(false);
  /** Starts unticked, ALWAYS — never seeded from a prop. */
  const [accepted, setAccepted] = useState(false);
  const prices = useAppStorePrices(LIVE_WATCH ? [LIVE_WATCH.productId] : [], open);
  const price = LIVE_WATCH ? prices.products.get(LIVE_WATCH.productId)?.displayPrice ?? null : null;
  const [buying, setBuying] = useState(false);
  const [screen, setScreen] = useState<IapScreen | null>(null);
  const locked = askReady && !accepted;

  const buy = () => {
    if (!LIVE_WATCH || buying || locked) return;
    setBuying(true);
    setScreen(null);
    void buyWithApple({ eventId, productId: LIVE_WATCH.productId }).then((s) => {
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
      <div className="px-4 pb-4 pt-3.5" data-iap-live-watch-sheet="">
        <h3 id={headingId} className="text-[19px] font-semibold tracking-tight text-ink">
          {screen?.kind === 'on' ? 'Live Watch is on' : screen?.kind === 'pending' ? IAP_COPY.pendingTitle : 'Live Watch'}
        </h3>
        {screen?.kind === 'on' ? (
          <>
            <p className="mt-1 text-sm text-ink/70">For this event, and everyone on it.</p>
            <div className="mt-3.5">
              <ActionButton tone="brand" main icon={<X aria-hidden strokeWidth={1.9} />} label="Done" onClick={close} />
            </div>
            <p className="mt-1.5 text-center text-xs text-ink/60">{IAP_COPY.receipt}</p>
          </>
        ) : screen?.kind === 'pending' ? (
          <>
            <p className="mt-1 text-sm text-ink/70">{screen.askToBuy ? IAP_COPY.askToBuy : pendingLine('Live Watch', false)}</p>
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
              <p className="mt-1 text-sm text-ink/70">
                One unlock covers the whole event — every stream, every camera, no day limit. Your free single camera
                stays free.
              </p>
            )}
            <div role="note" className="mt-3 max-h-48 space-y-2 overflow-y-auto text-xs leading-relaxed text-ink/80">
              {[YOUTUBE_READY_NOTICE, ENCODER_BUY_NOTICE, MUSIC_RIGHTS_NOTICE].map((line) => (
                <p key={line}>{line}</p>
              ))}
            </div>
            {askReady ? (
              <label id="iap-live-watch-ack" className="mt-3 flex min-h-11 cursor-pointer items-start gap-2.5 py-2 text-xs leading-relaxed text-ink/85">
                <input
                  type="checkbox"
                  checked={accepted}
                  onChange={(e) => {
                    const next = e.target.checked;
                    setAccepted(next);
                    // The shipped writer, asked once ever (owner 2026-09-02).
                    void setYoutubeLiveReadyAck(next).catch(() => {});
                  }}
                  className="mt-0.5 h-4 w-4 shrink-0 accent-mulberry"
                />
                <span>I understand, and I already have a YouTube account that is ready for live streaming.</span>
              </label>
            ) : null}
            {prices.state === 'silent' ? (
              <p className="mt-3 text-sm text-ink/70" role="status" data-iap-silent="">
                {IAP_COPY.storeSilent}
              </p>
            ) : null}
            <div className="mt-3.5">
              <button
                type="button"
                onClick={buy}
                disabled={buying || locked || !price}
                aria-describedby={locked ? 'iap-live-watch-ack' : undefined}
                data-iap-live-watch-buy=""
                className="ab ab-brand ab-main inline-flex min-h-11 w-full items-center justify-center disabled:opacity-60"
              >
                {buying
                  ? 'Opening the App Store…'
                  : locked
                    ? 'Tick the box above to continue'
                    : `${screen?.kind === 'failed' ? 'Try again' : 'Add Live Watch'}${price ? ` · ${price}` : ''}`}
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
      <ActionButton
        tone="brand"
        icon={<Radio aria-hidden="true" strokeWidth={1.9} />}
        label="Activate"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-expanded={open}
        data-testid="iap-live-watch-activate"
      />
      {sheet && typeof document !== 'undefined' ? createPortal(sheet, document.body) : null}
    </>
  );
}
