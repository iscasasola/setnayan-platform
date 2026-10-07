'use client';

/**
 * BuildCart — the two things at the thumb of the Suppliers screen (owner
 * 2026-10-07; corpus `SUPPLIERS_HANDOFF_2026-10-07_fable.md` PR1; prototype
 * `prototypes/suppliers_page_2026-10-07_fable.html`, `.lower` + `.cart`).
 *
 *   THE PILL   "View this build · 2 of 5 · ₱1,056,000" — black, in Find, once
 *              anything is picked. It opens Build.
 *   THE PEEK   a two-line black card that rises above the pill for 2.5 s when
 *              a supplier is added to the build (owner: *"like a shopping cart
 *              pop up"*): who was added, then the build's new count and total.
 *
 * NOT A NEW BUTTON AND NOT A NEW NUMBER. The pill is the shipped
 * `ActionButton` (neutral · main = the ink fill); its figures run on the one
 * counting engine (`useCountTo` — the pill's word is a string, so the engine
 * is read directly rather than through `<Count>`); the peek's are `<Count>`.
 * Both read the SAME tally the segmented control shows (`buildTally`).
 *
 * WHY A PORTAL. The dashboard's page wrapper carries a transform (the page
 * slide) and a container, either of which captures `position: fixed` — a bar
 * "fixed" inside it rides the page instead of the screen. Drawn into <body>.
 *
 * Nothing here writes: the pill and the peek's button only ask the shell for
 * the Build body over the shipped bus (`goToBuildTab`).
 */
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Hammer } from 'lucide-react';
import { ActionButton } from '@/components/action-button';
import { Count, useCountTo } from '@/components/count';
import { BB_BUILD_ADDED_EVENT, goToBuildTab, type BuildAdded } from '@/lib/budget-build';
import { buildTallyLine, tallyHasMoney, type BuildTally } from '@/lib/suppliers-shell';

/** How long the peek stays (the plan: "2.5 s"). */
export const CART_PEEK_MS = 2500;
/** The thumb row's slide, up and down (BUTTON_RULE rule 5 — "≈ 300 ms"). */
export const THUMB_SLIDE_MS = 300;

/** Above the phone's bottom bar (its measured height); a corner on a computer. */
const ABOVE_THE_DOCK = 'bottom-[calc(var(--sn-bottomdock-h,64px)_+_10px)] lg:bottom-7';
const ABOVE_THE_PILL = 'bottom-[calc(var(--sn-bottomdock-h,64px)_+_66px)] lg:bottom-24';

export function BuildCart({ tally, pillOn }: { tally: BuildTally; pillOn: boolean }) {
  // <body> exists only after mount — and the first paint needs neither piece.
  const [host, setHost] = useState<HTMLElement | null>(null);
  useEffect(() => setHost(document.body), []);

  const [added, setAdded] = useState<BuildAdded | null>(null);
  const [peekOn, setPeekOn] = useState(false);
  const timer = useRef<number | null>(null);
  useEffect(() => {
    const onAdded = (e: Event) => {
      const who = (e as CustomEvent<BuildAdded>).detail;
      if (!who?.name) return;
      setAdded(who);
      setPeekOn(true);
      if (timer.current != null) window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => setPeekOn(false), CART_PEEK_MS);
    };
    window.addEventListener(BB_BUILD_ADDED_EVENT, onAdded);
    return () => {
      window.removeEventListener(BB_BUILD_ADDED_EVENT, onAdded);
      if (timer.current != null) window.clearTimeout(timer.current);
    };
  }, []);

  const viewBuild = () => {
    setPeekOn(false);
    goToBuildTab('build');
  };

  // The pill's figures, counted (every number counts to its value).
  const withMoney = tallyHasMoney(tally);
  const filled = useCountTo(tally.filled, { id: 'sup-pill-filled' });
  const total = useCountTo(tally.total, { id: 'sup-pill-total' });
  const knownPhp = useCountTo(tally.knownPhp, { id: 'sup-pill-php' });

  if (!host) return null;
  return createPortal(
    <>
      {/* No pick, no pill — "0 of 0" is never drawn, even off-screen. */}
      {tally.filled > 0 ? (
        <div
          data-build-pill=""
          data-on={pillOn ? 'true' : 'false'}
          // Slid down — behind the phone's bottom bar, off the screen's edge on a
          // computer — and out of the tab order until it has slid up.
          inert={!pillOn}
          className={`pointer-events-none fixed inset-x-0 z-[25] flex justify-end px-4 transition-transform ease-out motion-reduce:transition-none lg:inset-x-auto lg:right-7 lg:px-0 ${ABOVE_THE_DOCK} ${
            pillOn ? 'translate-y-0' : 'translate-y-[calc(100%_+_48px)]'
          }`}
          style={{ transitionDuration: `${THUMB_SLIDE_MS}ms` }}
        >
          <ActionButton
            tone="neutral"
            main
            icon={Hammer}
            label={`View this build · ${buildTallyLine({ filled, total, knownPhp }, withMoney)}`}
            onClick={viewBuild}
            className="pointer-events-auto"
          />
        </div>
      ) : null}

      <div
        data-cart-peek=""
        data-on={peekOn ? 'true' : 'false'}
        role="status"
        aria-live="polite"
        inert={!peekOn}
        className={`fixed inset-x-4 z-[27] flex items-center gap-3 rounded-2xl bg-ink px-3.5 py-3 text-sm text-cream transition-[transform,opacity] duration-300 ease-out motion-reduce:transition-none lg:inset-x-auto lg:right-7 lg:w-[380px] ${ABOVE_THE_PILL} ${
          peekOn ? 'translate-y-0 opacity-100' : 'pointer-events-none translate-y-4 opacity-0'
        }`}
      >
        <div className="min-w-0 flex-1 leading-snug">
          <p className="truncate">
            <b className="font-semibold">{added?.name}</b>
            {added?.category ? <span className="text-cream/65"> · {added.category}</span> : null}
          </p>
          <p className="truncate">
            <span className="text-cream/65">
              This build · <Count value={tally.filled} id="sup-peek-filled" /> of{' '}
              <Count value={tally.total} id="sup-peek-total" />
              {withMoney ? ' · ' : ''}
            </span>
            {withMoney ? (
              <b className="font-semibold">
                <Count value={tally.knownPhp} format="peso" id="sup-peek-php" />
              </b>
            ) : null}
          </p>
        </div>
        {/* A neutral button on the ink card: its word and hairline take the
            card's own light ink, as a neutral button takes the page's. */}
        <ActionButton
          tone="neutral"
          icon={Hammer}
          label="View this build"
          onClick={viewBuild}
          className="!border-cream/40 !bg-cream/[0.14] !text-cream"
        />
      </div>
    </>,
    host,
  );
}
