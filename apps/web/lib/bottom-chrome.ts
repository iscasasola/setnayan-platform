/**
 * lib/bottom-chrome.ts — WHAT COUNTS AS A ROUTE'S OWN BOTTOM BAR, AND HOW FAR A BANNER LIFTS TO CLEAR IT.
 *
 * The geometry half of the cookie banner's `measureRouteBottomChrome`
 * (`app/_components/cookie-consent-banner.tsx`): that function goes looking for
 * every `fixed` / `sticky` element on the page; this decides, from their boxes
 * alone, which of them really are bars anchored to the bottom edge and how tall
 * the stack is. Split out (2026-10-11) so the rule is EXECUTED by a test — a
 * banner that lands on a bar is a geometry fault, and a regex cannot measure one.
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
