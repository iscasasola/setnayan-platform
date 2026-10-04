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
 *     edge (never flush under the bar), and the page's resting place is kept
 *     (the FIRST one, across a chain of edits);
 *   · `down()`  — the edit is over: the page goes back to that resting place, at
 *     once. ONLY the Maker says so (`settle`), when its LAST editing surface —
 *     the type bar or the part's sheet — closes (`editor-shell.tsx`). The end of
 *     typing on the canvas is NOT the end of the edit (the type bar stays open;
 *     Style ▾ hands it to the sheet), so there is no timer to race;
 *   · `forget()` — the page's place is no longer ours to restore: the Maker moved
 *     it on purpose (a tile, Page ▾), or a tap on the canvas ended the edit there;
 *   · a scroll the COUPLE makes (touch, wheel, a paging key OUTSIDE the words
 *     being typed) means they chose where the page is — then `down()` leaves it.
 *
 * Pure DOM, no React; `canvas-bring-up.test.ts` drives it with a fake window.
 */

/** Room left above a part brought up — it never sits flush under the Maker's bar. */
export const BRING_UP_GAP_PX = 16;
/** Below this width the Maker is a phone and a part is brought up at all. */
export const BRING_UP_BELOW_PX = 1024;

type BringUpWindow = Pick<Window, 'innerWidth' | 'scrollY' | 'scrollTo' | 'addEventListener' | 'removeEventListener'>;

export type CanvasBringUp = {
  up: (part: HTMLElement) => void;
  down: () => void;
  forget: () => void;
  dispose: () => void;
};

/** The keys that scroll a page — but inside words being typed they only move the caret. */
const PAGING_KEYS = new Set(['PageUp', 'PageDown', 'Home', 'End']);

/** Is this keystroke's target something being typed into (where a paging key moves the caret)? */
export function isTypingTarget(target: EventTarget | null): boolean {
  const el = target as (HTMLElement & { isContentEditable?: boolean }) | null;
  if (!el || typeof el !== 'object') return false;
  if (el.isContentEditable) return true;
  const tag = typeof el.tagName === 'string' ? el.tagName.toUpperCase() : '';
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
}

export function createCanvasBringUp(win: BringUpWindow): CanvasBringUp {
  /** Where the page rested before the first bring-up of this edit; null = nothing to undo. */
  let rest: number | null = null;
  /** The couple moved the page themselves (or the Maker did, on purpose): that place wins. */
  const theirPlace = () => {
    rest = null;
  };
  const onKey = (e: Event) => {
    const k = e as KeyboardEvent;
    // ✍ Home / End in "Maria" move the caret, not the page — never a scroll of theirs.
    if (PAGING_KEYS.has(k.key) && !isTypingTarget(k.target)) theirPlace();
  };
  win.addEventListener('wheel', theirPlace, { passive: true });
  win.addEventListener('touchmove', theirPlace, { passive: true });
  win.addEventListener('keydown', onKey);

  return {
    up(part) {
      if (win.innerWidth >= BRING_UP_BELOW_PX) return;
      if (rest === null) rest = win.scrollY;
      const top = part.getBoundingClientRect().top + win.scrollY - BRING_UP_GAP_PX;
      win.scrollTo({ top: Math.max(0, top), behavior: 'smooth' });
    },
    down() {
      const to = rest;
      rest = null;
      if (to !== null) win.scrollTo({ top: to, behavior: 'smooth' });
    },
    forget: theirPlace,
    dispose() {
      win.removeEventListener('wheel', theirPlace);
      win.removeEventListener('touchmove', theirPlace);
      win.removeEventListener('keydown', onKey);
    },
  };
}
