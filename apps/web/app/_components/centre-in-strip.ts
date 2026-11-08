/**
 * 🎯 CENTRE THE PICKED ITEM IN ITS STRIP (Build 2 row #36, prototype v116 `centerMk`).
 *
 * A menu strip keeps its picked item in the MIDDLE; at either end it simply stays at the end (the scroll is clamped
 * to 0…max). Only the STRIP scrolls — never `scrollIntoView`, which also slides the page body sideways (§10 #26).
 * Smooth, or instant under reduced motion / on a first open (`instant`). Pure DOM; returns where it scrolled to.
 */
export function centreScrollLeft(strip: { scrollLeft: number; scrollWidth: number; clientWidth: number }, stripLeft: number, stripWidth: number, itemLeft: number, itemWidth: number): number {
  const max = Math.max(0, strip.scrollWidth - strip.clientWidth);
  return Math.round(Math.max(0, Math.min(max, strip.scrollLeft + (itemLeft + itemWidth / 2) - (stripLeft + stripWidth / 2))));
}

export function centreInStrip(strip: HTMLElement | null, item: HTMLElement | null, instant = false): number | null {
  if (!strip || !item) return null;
  const sr = strip.getBoundingClientRect();
  const ir = item.getBoundingClientRect();
  if (!sr.width) return null;
  const to = centreScrollLeft(strip, sr.left, sr.width, ir.left, ir.width);
  if (Math.abs(to - strip.scrollLeft) >= 1) {
    const still = instant || (typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true);
    strip.scrollTo({ left: to, behavior: still ? 'auto' : 'smooth' });
  }
  return to;
}

/**
 * A body swipe that turns the page (v116): at least 60 px sideways and 1.5× more sideways than down. Returns the step
 * (+1 next, −1 previous) or 0. Pure — the caller decides where a swipe may start.
 */
export const PAGE_SWIPE = { minPx: 60, ratio: 1.5 } as const;
export function pageSwipeStep(dx: number, dy: number): 1 | -1 | 0 {
  if (Math.abs(dx) < PAGE_SWIPE.minPx || Math.abs(dx) < Math.abs(dy) * PAGE_SWIPE.ratio) return 0;
  return dx < 0 ? 1 : -1;
}
