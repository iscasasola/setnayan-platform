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
import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Info, X } from 'lucide-react';
import { ActionButton } from '@/components/action-button';
import { InSheet } from '@/app/_components/sheet';
import { usePortalHost } from '@/lib/use-portal-host';
import { useModalA11y } from '@/lib/use-modal-a11y';
import { useBackCloses } from '@/lib/use-back-closes';
import { closeWindow, growPlan, riseOriginNow, riseScreenMotion, watchRiseOrigins, type GrowPlan, type GrowWindow, type RiseRect } from '@/lib/rise-screen';
import { EASE_EMPHASIZED } from '@/lib/motion-table';
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

/** The tapped thing's own corner — the shape grows from IT, not from a fixed 14 px. */
function radiusOf(el: HTMLElement | null): number {
  if (!el || !el.isConnected) return 14;
  const n = parseFloat(getComputedStyle(el).borderTopLeftRadius);
  return Number.isFinite(n) ? n : 14;
}

/**
 * 🎞 THE GROW'S PARTS (approved grow-full-screen-fable.html, "Rules for the build"): the page behind steps back under a
 * light dim · the content arrives in three steps · ✕ and the bar arrive last. Transform and opacity only; every
 * animation here holds nothing once it ends (no `fill: forwards` on the open), because a kept transform on an ancestor
 * traps every `position: fixed` child. Opening: `out = false`; closing: the same windows mirrored at 80 % (`closeWindow`).
 */
function playGrowParts(root: HTMLElement, plan: GrowPlan, out: boolean): Animation[] {
  const anims: Animation[] = [];
  const win = (w: GrowWindow) => (out ? closeWindow(w, plan) : w);
  const go = (el: Element | null, frames: Keyframe[], w: GrowWindow) => {
    if (!el || typeof (el as HTMLElement).animate !== 'function' || w.duration <= 0) return;
    const at = win(w);
    anims.push(
      (el as HTMLElement).animate(frames, {
        duration: at.duration,
        delay: at.delay,
        easing: EASE_EMPHASIZED,
        direction: out ? 'reverse' : 'normal',
        // Open: hidden until its step (backwards), then nothing held. Close: stays gone until the screen leaves.
        fill: out ? 'forwards' : 'backwards',
      }),
    );
  };
  const rise = [{ opacity: 0, transform: `translateY(${plan.stepRisePx}px)` }, { opacity: 1, transform: 'none' }];
  // Three steps: the head's words · the body's first block · the rest of the first screenful.
  const blocks = Array.from(root.querySelector('[data-rise-body] > div')?.children ?? []);
  const vh = window.innerHeight;
  const onScreen = blocks.filter((b) => b.getBoundingClientRect().top < vh);
  go(root.querySelector('[data-rise-title]'), rise, plan.steps[0]!);
  go(onScreen[0] ?? null, rise, plan.steps[1]!);
  for (const b of onScreen.slice(1)) go(b, rise, plan.steps[2]!);
  // ✕ and ⓘ, then the bar — last.
  for (const c of Array.from(root.querySelectorAll('[data-rise-close], [data-rise-info-button]'))) {
    go(c, [{ opacity: 0, transform: 'scale(.9)' }, { opacity: 1, transform: 'none' }], plan.chrome);
  }
  go(root.querySelector('[data-rise-thumb]'), [{ transform: 'translateY(100%)' }, { transform: 'none' }], plan.bar);
  return anims;
}

/**
 * The page behind steps back to 0.96 under a light dim while the shape opens (and comes forward while it closes). Each
 * of <body>'s other children is scaled about the middle of the SCREEN, so a long page recedes towards where you are
 * looking. Nothing is held: the transform is gone when the animation ends (the screen covers the page by then).
 */
function playBehind(screen: HTMLElement, plan: GrowPlan, out: boolean): Animation[] {
  const anims: Animation[] = [];
  const at = out ? closeWindow(plan.behind, plan) : plan.behind;
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  for (const el of Array.from(document.body.children) as HTMLElement[]) {
    if (el === screen || el.contains(screen) || el.tagName === 'SCRIPT' || el.dataset.riseDim !== undefined) continue;
    const r = el.getBoundingClientRect();
    if (!(r.width > 0 && r.height > 0) || typeof el.animate !== 'function') continue;
    el.style.transformOrigin = `${vw / 2 - r.left}px ${vh / 2 - r.top}px`;
    const a = el.animate([{ transform: 'none' }, { transform: `scale(${plan.behind.scale})` }], {
      duration: at.duration,
      delay: at.delay,
      easing: EASE_EMPHASIZED,
      direction: out ? 'reverse' : 'normal',
    });
    a.finished.then(() => (el.style.transformOrigin = ''), () => (el.style.transformOrigin = ''));
    anims.push(a);
  }
  const dim = document.createElement('div');
  dim.dataset.riseDim = '';
  dim.setAttribute('aria-hidden', 'true');
  dim.style.cssText = 'position:fixed;inset:0;pointer-events:none;background:#000;opacity:0;z-index:var(--sn-z-pop)';
  screen.before(dim);
  const d = dim.animate([{ opacity: 0 }, { opacity: plan.behind.dim }], {
    duration: at.duration,
    delay: at.delay,
    easing: EASE_EMPHASIZED,
    direction: out ? 'reverse' : 'normal',
  });
  d.finished.then(() => dim.remove(), () => dim.remove());
  anims.push(d);
  return anims;
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
  /** `data-rise-screen` — the guard's and the lab's anchor. */
  data: string;
  children: ReactNode;
};

export function RiseScreen({ title, line, info, labelledById, actions, thumb, fill = false, onClose, data, children }: RiseScreenProps) {
  const host = usePortalHost();
  const rootRef = useRef<HTMLDivElement | null>(null);
  const originRef = useRef<HTMLElement | null>(null);
  const closingRef = useRef(false);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
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
    const reduced = prefersReducedMotion();
    const m = riseScreenMotion(rectOf(originRef.current), viewport(), reduced, radiusOf(originRef.current));
    if (m && typeof el.animate === 'function') el.animate(m.frames, m.timing);
    // 🎞 The grow's parts — only when it grows from a press (a deep link simply appears, as before).
    const plan = m && !reduced ? growPlan(reduced, true) : null;
    if (plan && typeof el.animate === 'function') {
      playBehind(el, plan, false);
      playGrowParts(el, plan, false);
    }
    // Once, when the portal lands.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [host]);

  // ⤵ CLOSE — the same frames played backwards into the same thing, then the caller's onClose.
  const playClose = useCallback(() => {
    if (closingRef.current) return;
    closingRef.current = true;
    const done = () => onCloseRef.current();
    const el = rootRef.current;
    const reduced = prefersReducedMotion();
    const m = riseScreenMotion(rectOf(originRef.current), viewport(), reduced, radiusOf(originRef.current));
    if (!el || !m || typeof el.animate !== 'function') return done();
    // ⤵ Every window mirrored at 80 %: the chrome and the steps leave first, then the shape closes into the thing you
    // tapped while the page behind comes forward. The caller unmounts once the shape has landed.
    const plan = !reduced ? growPlan(reduced, true) : null;
    if (plan) {
      playGrowParts(el, plan, true);
      playBehind(el, plan, true);
    }
    const shapeDelay = plan ? closeWindow(plan.shape, plan).delay : 0;
    el.animate(m.frames, { ...m.closeTiming, delay: shapeDelay, direction: 'reverse', fill: 'forwards' }).finished.then(done, done);
  }, []);

  // ← The phone's Back closes the screen, not the page; ✕ and Esc step back through the same entry.
  const close = useBackCloses(true, playClose);

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
          <span className="min-w-0 flex-1" data-rise-title="">
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
          <InSheet.Provider value>{children}</InSheet.Provider>
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
