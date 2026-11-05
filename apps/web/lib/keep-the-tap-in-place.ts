/**
 * keep-the-tap-in-place.ts — WHEN OPENING ONE THING SHUTS ANOTHER ABOVE IT, THE THING YOU TAPPED STAYS UNDER YOUR FINGER.
 *
 * 🔴 THE BUG (owner, iPhone, live card maker 2026-11-04 — "i keep going to this blank slate. when i first clicked
 * inclusions and now schedule"). ONE OPEN AT A TIME (`lib/one-open.ts`) shuts the open fold when a peer opens. When
 * that fold sits ABOVE the tapped control, everything below it moves up by the fold's height while the page's scroll
 * position stays put — so the screen is suddenly showing what was further down: on a short form, the white past its
 * end, with the Schedule menu still floating where its button USED to be. Chrome hides this with CSS scroll
 * anchoring; Safari (every iPhone browser) does not do scroll anchoring, so 99 % of our viewers got the blank.
 * Reproduced in Playwright WebKit at 390×844 on `/dev/card-maker-lab` (2026-11-04).
 *
 * ✅ THE FIX, ONCE, IN THE SHARED MECHANISM. The element last pressed is remembered (capture-phase `pointerdown`, so it
 * is the real tap target, whatever opens). When an opening shuts a peer, the pressed element's top is measured and,
 * frame by frame for the length of the fold's height move, whatever it scrolls in is scrolled by exactly the distance
 * it moved. Where the browser already anchored (Chrome) the measured move is 0 and nothing is scrolled — no double
 * correction. A keyboard or programmatic open has no tap and changes nothing.
 * 🔒 lib/keep-the-tap-in-place.test.ts
 */

/** How long a shut fold keeps moving: the press family's pill speed (700 ms) plus a margin. */
export const KEEP_IN_PLACE_MS = 900;
/** A tap older than this did not cause the opening being announced. */
const TAP_FRESH_MS = 1200;

/** How far to scroll so the pressed element is back where it was. Sub-pixel noise is not a move. */
export function scrollToKeep(topBefore: number, topNow: number): number {
  const d = topNow - topBefore;
  return Math.abs(d) < 0.5 ? 0 : d;
}

let lastTap: { el: Element; at: number } | null = null;
let listening = false;

function listen(): void {
  if (listening || typeof window === 'undefined') return;
  listening = true;
  window.addEventListener(
    'pointerdown',
    (e) => {
      if (e.target instanceof Element) lastTap = { el: e.target, at: Date.now() };
    },
    { capture: true, passive: true },
  );
}

/** Called by every opener that joins ONE OPEN, so the listener is live before the first tap that matters. */
export function rememberTaps(): void {
  listen();
}

function scrollerOf(el: Element): HTMLElement | null {
  for (let p = el.parentElement; p && p !== document.body && p !== document.documentElement; p = p.parentElement) {
    const oy = getComputedStyle(p).overflowY;
    if ((oy === 'auto' || oy === 'scroll') && p.scrollHeight > p.clientHeight) return p;
  }
  return null;
}

let keeping = 0;
/** Stop correcting now — something (a reveal sweep) is moving the page on purpose. */
export function stopKeepingTheTap(): void {
  keeping++;
}

/**
 * Call BEFORE peers are shut. Returns nothing; it watches the tapped element for `KEEP_IN_PLACE_MS` and scrolls back
 * by however far it was pushed.
 */
export function keepTheTapInPlace(): void {
  if (typeof window === 'undefined' || typeof requestAnimationFrame === 'undefined') return;
  const tap = lastTap;
  if (!tap || Date.now() - tap.at > TAP_FRESH_MS || !tap.el.isConnected) return;
  const el = tap.el;
  const scroller = scrollerOf(el);
  let top = el.getBoundingClientRect().top;
  const run = ++keeping;
  const until = performance.now() + KEEP_IN_PLACE_MS;
  const step = () => {
    if (!el.isConnected || run !== keeping) return;
    const now = el.getBoundingClientRect().top;
    const by = scrollToKeep(top, now);
    if (by !== 0) {
      if (scroller) scroller.scrollTop += by;
      else window.scrollBy(0, by);
      // Re-read: the page may be too short to scroll the whole way back; never chase what cannot be reached.
      top = el.getBoundingClientRect().top;
      // Anything placed against the tapped control (an open PickMenu list) re-places on resize — tell it the page
      // moved, even when the scroll could not take all of it back (no scroll event fires then).
      window.dispatchEvent(new Event('resize'));
    }
    if (performance.now() < until) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}
