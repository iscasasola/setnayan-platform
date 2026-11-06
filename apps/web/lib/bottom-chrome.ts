/**
 * lib/bottom-chrome.ts — WHAT COUNTS AS A ROUTE'S OWN BOTTOM BAR, AND HOW FAR A BANNER LIFTS TO CLEAR IT.
 *
 * Given every `fixed` / `sticky` element's box, this decides which of them
 * really are bars anchored to the bottom edge and how tall the stack is. Split
 * out (2026-10-11) for the cookie banner — removed 2026-10-22 with optional
 * analytics — so the rule is EXECUTED by a test (`bottom-chrome-lift.test.ts`);
 * `lib/reveal-above-chrome.ts` reads it today.
 *
 * Pure. No DOM.
 */

/** A box in viewport pixels (`getBoundingClientRect`). */
export type ChromeBox = { top: number; bottom: number; width: number; height: number };

/**
 * Is this box a bar anchored to the bottom edge? Excludes anything too small to
 * be one, anything taller than ~45 % of the window (a decorative full-height
 * layer, not real chrome), anything not touching the bottom edge, and anything
 * that starts above the vertical midline (a modal / full-screen sheet).
 */
export function isBottomBar(r: ChromeBox, vh: number): boolean {
  if (r.width < 40 || r.height < 8) return false; // not a real bar
  if (r.height > vh * 0.45) return false; // a decorative full-height layer
  if (r.bottom < vh - 4) return false; // not touching the bottom edge
  if (r.top < vh * 0.5) return false; // a modal/sheet starting mid-screen, not a bar
  return true;
}

/** How far to lift off the true bottom edge so a banner sits ABOVE every bottom bar among `boxes`. 0 when there is none. */
export function bottomChromeLift(boxes: readonly ChromeBox[], vh: number): number {
  let max = 0;
  for (const r of boxes) if (isBottomBar(r, vh)) max = Math.max(max, vh - r.top);
  return Math.round(max);
}

/**
 * 📱 AN OPEN LIST NEVER HIDES UNDER THE BOTTOM BAR (2026-10-20, the owner's 375 px shot: the bar — Guests · Suppliers ·
 * Hub · More — drew over the open Group list; "＋ New group…"'s Create / × sat under it). The same boxes, the other edge:
 * how far down the screen the bars stuck to the TOP reach (a stuck shell bar, a sticky card head), so a box revealed
 * between the two never tucks under either. The DOM half is `lib/reveal-above-chrome.ts`.
 */
export function topChromeDrop(boxes: readonly ChromeBox[], vh: number): number {
  let max = 0;
  for (const r of boxes) {
    if (r.width < 40 || r.height < 8 || r.height > vh * 0.45) continue;
    if (r.top > 4 || r.bottom <= 0) continue; // not stuck to the top edge
    max = Math.max(max, r.bottom);
  }
  return Math.round(max);
}

/** Room kept between a revealed box and a bar. */
export const REVEAL_MARGIN = 8;

/**
 * How far to scroll (positive = further down the page) so `box` sits inside `clear` with `margin` to spare: its bottom
 * first, but never so far that its top goes under the top bar — a box taller than the room shows its top.
 */
export function revealDelta(box: { top: number; bottom: number }, clear: { top: number; bottom: number }, margin = REVEAL_MARGIN): number {
  const floor = clear.bottom - margin;
  const ceil = clear.top + margin;
  if (box.bottom > floor) return Math.round(Math.min(box.bottom - floor, box.top - ceil));
  if (box.top < ceil) return Math.round(box.top - ceil);
  return 0;
}
