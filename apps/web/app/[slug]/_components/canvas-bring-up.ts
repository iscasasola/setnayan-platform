/**
 * 📱 THE BRING-UP, AND THE WAY BACK — the canvas side of "edit a part on a phone".
 *
 * A tap on a part (the names, a heading) on a phone raises the keyboard or the
 * part's sheet over the lower canvas, so the part is brought up the page. Until
 * 2026-10-05 that was `part.scrollIntoView({ block: 'start' })`, in two places
 * (`type-in-place-canvas.ts`, `editor-bridge.tsx`), and NOTHING put the page
 * back: owner, iPhone, 2026-10-05, the Invitation "as a guest sees it" with the
 * card's top gone — its border, "Together with their families", the monogram —
 * and "Maria" flush against the Maker's bar. MEASURED on the live Maker at
 * 375 × 812: tap "Maria" and the names land at 0 px (flush under the bar);
 * press Done and the canvas STAYS 309 px down the page.
 *
 * Now, one helper owns both halves:
 *   · `up(part)` — the part lands {@link BRING_UP_GAP_PX} below the canvas's top
 *     edge (never flush under the bar), and the page's resting place is kept;
 *   · `down()`  — when the edit is over, the page goes back to that resting place,
 *     a moment later ({@link SETTLE_MS}) so an edit that hands on to another
 *     (the type bar's Style opens the part's sheet) never bounces;
 *   · `hold()`  — the edit continues on another surface: no way back yet;
 *   · `forget()` — the Maker moved the page on purpose (a tile, Page ▾): its
 *     place wins, and there is nothing to go back to;
 *   · a scroll the COUPLE makes (touch, wheel, keys) while editing means they
 *     chose where the page is — then `down()` leaves it there.
 *
 * Pure DOM, no React; `canvas-bring-up.test.ts` drives it with a fake window.
 */

/** Room left above a part brought up — it never sits flush under the Maker's bar. */
export const BRING_UP_GAP_PX = 16;
/** The pause before the way back, so a hand-over (typing → the part's sheet) can hold it. */
export const SETTLE_MS = 250;
/** Below this width the Maker is a phone and a part is brought up at all. */
export const BRING_UP_BELOW_PX = 1024;

type BringUpWindow = Pick<
  Window,
  'innerWidth' | 'scrollY' | 'scrollTo' | 'setTimeout' | 'clearTimeout' | 'addEventListener' | 'removeEventListener'
>;

export type CanvasBringUp = {
  up: (part: HTMLElement) => void;
  down: () => void;
  hold: () => void;
  forget: () => void;
  dispose: () => void;
};

export function createCanvasBringUp(win: BringUpWindow): CanvasBringUp {
  /** Where the page rested before the first bring-up of this edit; null = nothing to undo. */
  let rest: number | null = null;
  let timer: number | null = null;
  const cancel = () => {
    if (timer !== null) win.clearTimeout(timer);
    timer = null;
  };
  /** The couple moved the page themselves: their place wins. */
  const theyScrolled = () => {
    rest = null;
    cancel();
  };
  const onKey = (e: Event) => {
    const k = (e as KeyboardEvent).key;
    if (k === 'PageUp' || k === 'PageDown' || k === 'Home' || k === 'End') theyScrolled();
  };
  win.addEventListener('wheel', theyScrolled, { passive: true });
  win.addEventListener('touchmove', theyScrolled, { passive: true });
  win.addEventListener('keydown', onKey);

  return {
    up(part) {
      if (win.innerWidth >= BRING_UP_BELOW_PX) return;
      cancel();
      if (rest === null) rest = win.scrollY;
      const top = part.getBoundingClientRect().top + win.scrollY - BRING_UP_GAP_PX;
      win.scrollTo({ top: Math.max(0, top), behavior: 'smooth' });
    },
    down() {
      if (rest === null) return;
      cancel();
      timer = win.setTimeout(() => {
        timer = null;
        const to = rest;
        rest = null;
        if (to !== null) win.scrollTo({ top: to, behavior: 'smooth' });
      }, SETTLE_MS);
    },
    hold() {
      cancel();
    },
    forget: theyScrolled,
    dispose() {
      cancel();
      win.removeEventListener('wheel', theyScrolled);
      win.removeEventListener('touchmove', theyScrolled);
      win.removeEventListener('keydown', onKey);
    },
  };
}
