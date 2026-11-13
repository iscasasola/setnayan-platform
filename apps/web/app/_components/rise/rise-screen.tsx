'use client';

/**
 * ⤴ RISE FULL SCREEN — THE ONE SCREEN EVERY AVATAR ROW, EVERY ⚙ AND EVERY TAPPABLE BLOCK OPENS INTO (Build 5 · Lane A;
 * owner 2026-11-10 *"risefull screen is what we call it"* · *"fullscreen everything"*; DECISION_LOG 2026-11-10 "RISE FULL
 * SCREEN IS THE NAME; FULL SCREEN EVERYTHING" + 2026-11-09 "ONE WAY TO GO FULL SCREEN, APP-WIDE" + "FULL SCREEN ALWAYS
 * LOSES THE BOTTOM NAV"; HOUSE_TEMPLATES T4). Approved prototypes: `settings_full_screen_2026-11-10/settings-full-screen.html`
 * (the head: ✕ · title over one short line · ⓘ) and `supplier_clients_2026-11-07/supplier-menu-r2.v119.html` (`riseSheet`:
 * the shipped sheet's own body, risen full height under a ✕ bar).
 *
 * Built from the picked-client shell (`app/_components/picked/picked-shell.tsx`), not beside it — the same layer, the
 * same motion, the same bars:
 *   OPEN     it grows out of the thing you tapped — a `clip-path` from that rect to the whole screen (the picked
 *            client's `rectClip` rule), the ONE rise (`RISE_MS` · `RISE_EASE`, 0.7 s once #7431 lands); origin and
 *            frames are pure, in `lib/rise-screen.ts`. No tap behind it (a deep link, a reload): it is simply there.
 *   CLOSE    ✕ (or Esc, or the phone's Back) plays the SAME frames in reverse back into that thing, then the caller's
 *            `onClose`. The page under it never moved: `useModalA11y` pins it and puts it back on the same pixel.
 *   BARS     while it is up the top bar slides up and the bottom nav slides down (`useChromeAway`, 0.32 s), and come
 *            back on close — the exact reverse. Never drawn with the bars.
 *   REDUCED  a 120 ms cross-fade both ways, no movement.
 *   LAYERS   the pop layer (`--sn-z-pop`, drawn on <body>) — over the thumb row and the bar; a picker or sheet opened
 *            from inside it is at `--sn-z-modal`, above it. ONE LEVEL: sections inside open in place, never a second
 *            full screen on top.
 *
 * The tab you are on, tapped again (`sn:tab-reselect`), still goes to its top: the screen closes at once and the tab's
 * own handler runs (T5).
 *
 * Never a second copy: a ⚙ rises through `MenuSettingsButton rise`, everything else mounts this.
 * 🔒 app/_components/rise/the-rise-screen-is-one-full-screen.test.ts
 */
import { createContext, useCallback, useContext, useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Info, X } from 'lucide-react';
import { ActionButton } from '@/components/action-button';
import { InSheet } from '@/app/_components/sheet';
import { usePortalHost } from '@/lib/use-portal-host';
import { useModalA11y } from '@/lib/use-modal-a11y';
import { useBackCloses } from '@/lib/use-back-closes';
import { riseOriginNow, riseScreenMotion, watchRiseOrigins, type RiseRect } from '@/lib/rise-screen';
import { prefersReducedMotion } from '@/app/_components/picked/picked-motion';
import { useRevealOnOpen } from '@/app/_components/reveal-on-open';
import { TAB_RESELECT_EVENT, useChromeAway } from '@/app/_components/nav/use-chrome-away';

// Note presses from the moment this part is on the client, so the first door tapped already has an origin.
if (typeof window !== 'undefined') watchRiseOrigins();

function rectOf(el: HTMLElement | null): RiseRect | null {
  if (!el || !el.isConnected) return null;
  const r = el.getBoundingClientRect();
  return r.width > 0 && r.height > 0 ? { top: r.top, left: r.left, width: r.width, height: r.height } : null;
}

const viewport = () => ({ width: window.innerWidth, height: window.innerHeight });

/**
 * ⤵ THE SAME CLOSE FROM INSIDE (13 Nov rollout): a "Done" / "Not now" drawn in the body steps out exactly as ✕ does — the
 * same reverse into the thing you tapped, through the same Back entry — never an unmount that skips the fall. Outside a
 * RiseScreen it is null, so a part drawn in both a sheet and a rise falls back to its own close.
 */
const RiseCloseContext = createContext<(() => void) | null>(null);
export function useRiseClose(): (() => void) | null {
  return useContext(RiseCloseContext);
}

/** Render-prop form for a part whose close buttons live in the same component that mounts the screen. */
export function WithRiseClose({ fallback, children }: { fallback: () => void; children: (close: () => void) => ReactNode }) {
  const close = useRiseClose();
  return <>{children(close ?? fallback)}</>;
}

export type RiseScreenProps = {
  /** The head's name (the settings prototype: bold, over one short line). Absent: the body draws its own heading — pass
   *  `labelledById` — and the head is the ✕ alone (v119's `rbar`). */
  title?: string;
  /** One short line under the title; the rest goes in the ⓘ (T17). */
  line?: string;
  /** ⓘ — what this screen is for, shown under the head on a tap. Absent: no ⓘ (never a dead one). */
  info?: ReactNode;
  /** The id of the heading the body draws itself (when there is no `title`). */
  labelledById?: string;
  /** The head's own action(s), between the title and the ⓘ (a period dropdown, "Open in browser ↗"). */
  actions?: ReactNode;
  /** The one main action, in the thumb zone at the foot. */
  thumb?: ReactNode;
  /** The body FILLS the screen (the shop as couples see it): no scroll of its own, the child scrolls itself. */
  fill?: boolean;
  /** Called once the close has played (the caller unmounts the screen). */
  onClose: () => void;
  /** While true (a purchase in flight) ✕, Esc, Back and an inner close all wait — the screen stays up. */
  busy?: boolean;
  /** `data-rise-screen` — the guard's and the lab's anchor. */
  data: string;
  children: ReactNode;
};

export function RiseScreen({ title, line, info, labelledById, actions, thumb, fill = false, onClose, busy = false, data, children }: RiseScreenProps) {
  const host = usePortalHost();
  const rootRef = useRef<HTMLDivElement | null>(null);
  const originRef = useRef<HTMLElement | null>(null);
  const closingRef = useRef(false);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const busyRef = useRef(busy);
  busyRef.current = busy;
  const headingId = useId();
  const infoId = useId();
  const [infoOpen, setInfoOpen] = useState(false);
  const infoRef = useRef<HTMLDivElement | null>(null);
  // ⓘ opens like every other expand in the app — through the ONE reveal (owner 2026-11-04): if the words run past the
  // screen they glide into view; when they fit, nothing moves.
  const intendInfo = useRevealOnOpen(infoOpen, () => ({ head: infoRef.current }));

  // 🫥 The bars step away while the screen is up, and come back the exact reverse when it goes (T4).
  useChromeAway(true);

  useEffect(() => watchRiseOrigins(), []);

  // 🎬 OPEN — out of the thing you tapped, once the screen stands on <body>.
  useLayoutEffect(() => {
    const el = rootRef.current;
    if (!el || !host) return;
    originRef.current = riseOriginNow();
    const m = riseScreenMotion(rectOf(originRef.current), viewport(), prefersReducedMotion());
    if (m && typeof el.animate === 'function') el.animate(m.frames, m.timing);
    // Once, when the portal lands.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [host]);

  // ⤵ CLOSE — the same frames played backwards into the same thing, then the caller's onClose.
  const playClose = useCallback(() => {
    if (closingRef.current || busyRef.current) return;
    closingRef.current = true;
    const done = () => onCloseRef.current();
    const el = rootRef.current;
    const m = riseScreenMotion(rectOf(originRef.current), viewport(), prefersReducedMotion());
    if (!el || !m || typeof el.animate !== 'function') return done();
    el.animate(m.frames, { ...m.timing, direction: 'reverse', fill: 'forwards' }).finished.then(done, done);
  }, []);

  // ← The phone's Back closes the screen, not the page; ✕ and Esc step back through the same entry.
  const backClose = useBackCloses(true, playClose);
  const close = useCallback(() => {
    if (!busyRef.current) backClose();
  }, [backClose]);

  // The house modal contract: focus in, Tab kept inside, Esc closes (only the topmost layer answers), the page under it
  // held still and put back on the same pixel.
  useModalA11y({ open: Boolean(host), onClose: close, containerRef: rootRef });

  // T5 — the tab you are on, tapped again, goes to its top: this screen gets out of the way at once.
  useEffect(() => {
    const on = () => {
      closingRef.current = true;
      onCloseRef.current();
    };
    window.addEventListener(TAB_RESELECT_EVENT, on);
    return () => window.removeEventListener(TAB_RESELECT_EVENT, on);
  }, []);

  const labelled = title ? headingId : labelledById;

  const screen = (
    <div
      ref={rootRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby={labelled}
      data-rise-screen={data}
      className="fixed inset-0 z-sn-pop flex h-[100dvh] flex-col bg-cream text-ink outline-none"
    >
      {/* 📌 The head: ✕ · the title over its one line · the screen's own action · ⓘ (settings prototype `.fs-head`). */}
      <div className="shrink-0 border-b border-ink/10 bg-cream pt-[env(safe-area-inset-top)]" data-rise-head="">
        <div className="mx-auto flex min-h-[60px] w-full max-w-3xl items-center gap-2.5 px-4 py-2">
          <span className="inline-flex shrink-0" data-rise-close="">
            <ActionButton tone="neutral" iconOnly icon={X} label="Close" onClick={close} />
          </span>
          <span className="min-w-0 flex-1">
            {title ? (
              <>
                <b id={headingId} className="block truncate text-[17px] font-bold leading-tight text-ink">
                  {title}
                </b>
                {line ? <small className="block truncate text-[12.5px] text-ink/60">{line}</small> : null}
              </>
            ) : null}
          </span>
          {actions ? <span className="flex shrink-0 items-center gap-1.5">{actions}</span> : null}
          {info ? (
            <span className="inline-flex shrink-0" data-rise-info-button="">
              <ActionButton tone="neutral" iconOnly icon={Info} label="About this screen" onClick={() => {
                intendInfo();
                setInfoOpen((v) => !v);
              }} aria-expanded={infoOpen} />
            </span>
          ) : null}
        </div>
        {info && infoOpen ? (
          <div ref={infoRef} id={infoId} role="note" className="border-t border-ink/10 bg-raised" data-rise-info="">
            <div className="mx-auto w-full max-w-3xl px-4 py-2.5 text-[13.5px] leading-relaxed text-ink/75">{info}</div>
          </div>
        ) : null}
      </div>
      <div
        className={`min-h-0 flex-1 overscroll-contain ${fill ? 'flex flex-col overflow-hidden' : 'overflow-y-auto'}`}
        data-rise-body=""
      >
        <div
          className={
            fill
              ? 'flex min-h-0 w-full flex-1 flex-col'
              : `mx-auto w-full max-w-3xl ${thumb ? 'pb-4' : 'pb-[max(calc(env(safe-area-inset-bottom)+24px),24px)]'}`
          }
        >
          {/* Inside this layer a part that floats at the foot (the supplier's thumb row) stays IN it, never under it. */}
          <InSheet.Provider value>
            <RiseCloseContext.Provider value={close}>{children}</RiseCloseContext.Provider>
          </InSheet.Provider>
        </div>
      </div>
      {thumb ? (
        <div className="shrink-0 bg-cream px-4 pb-[max(env(safe-area-inset-bottom),16px)] pt-2" data-rise-thumb="">
          <div className="mx-auto w-full max-w-3xl">{thumb}</div>
        </div>
      ) : null}
    </div>
  );

  // Drawn on <body> once it exists (the first frame is drawn in place, so server HTML and first paint agree).
  return host ? createPortal(screen, host) : screen;
}
