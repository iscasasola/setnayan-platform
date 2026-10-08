'use client';

/**
 * BuildCart — THE CART PEEK of the Suppliers screen (owner 2026-10-07: *"when
 * you click add to build a small pop up showing our build (like a shopping
 * cart pop up)"*; corpus `SUPPLIERS_HANDOFF_2026-10-07_fable.md` PR1;
 * prototype `prototypes/suppliers_page_2026-10-07_fable.html`, `.cart`).
 *
 * A two-line ink card that rises above the thumb row for 2.5 s when a supplier
 * is added to the build: who was added, then the build's new count and total,
 * and "View this build". It peeks only for a pick that SAVED.
 *
 * ⚖ THERE IS NO "VIEW THIS BUILD" PILL IN THE THUMB BAR. The first plan drew
 * one; the owner's 2026-10-07 evening ruling took it out — *the Build segment
 * and this peek are the doors* — and the prototype at corpus HEAD draws none.
 * In Find the thumb bar is the search · add row (PR2).
 *
 * NOT A NEW BUTTON AND NOT A NEW NUMBER. The button is the shipped
 * `ActionButton`; the figures are `<Count>` over the SAME tally the segmented
 * control shows (`buildTally`).
 *
 * WHY A PORTAL. The dashboard's page wrapper carries a transform (the page
 * slide) and a container, either of which captures `position: fixed` — a card
 * "fixed" inside it rides the page instead of the screen. Drawn into <body>.
 *
 * Nothing here writes: the button only asks the shell for the Build body over
 * the shipped bus (`goToBuildTab`).
 */
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Hammer } from 'lucide-react';
import { ActionButton } from '@/components/action-button';
import { Count } from '@/components/count';
import { BB_BUILD_ADDED_EVENT, goToBuildTab, type BuildAdded } from '@/lib/budget-build';
import { tallyHasMoney, type BuildTally } from '@/lib/suppliers-shell';

/** How long the peek stays (the plan: "2.5 s"). */
export const CART_PEEK_MS = 2500;
/** Above the thumb row, which sits above the phone's bottom bar (its measured
 *  height); a corner on a computer — where the prototype draws it. */
const ABOVE_THE_THUMB = 'bottom-[calc(var(--sn-bottomdock-h,64px)_+_76px)] lg:bottom-24';

export function BuildCart({ tally }: { tally: BuildTally }) {
  // <body> exists only after mount — and the first paint does not need the peek.
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

  const withMoney = tallyHasMoney(tally);

  if (!host) return null;
  return createPortal(
    <div
      data-cart-peek=""
      data-on={peekOn ? 'true' : 'false'}
      role="status"
      aria-live="polite"
      inert={!peekOn}
      className={`fixed inset-x-4 z-[27] flex items-center gap-3 rounded-2xl bg-ink px-3.5 py-3 text-sm text-cream transition-[transform,opacity] duration-300 ease-out motion-reduce:transition-none lg:inset-x-auto lg:right-7 lg:w-[380px] ${ABOVE_THE_THUMB} ${
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
    </div>,
    host,
  );
}
