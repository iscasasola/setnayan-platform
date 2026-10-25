/**
 * reveal-above-chrome.ts — 📱 THE DOM HALF OF "AN OPEN LIST NEVER HIDES UNDER THE BOTTOM BAR" (2026-10-20; the rule is
 * `lib/bottom-chrome.ts`, the one rule for what counts as a bottom bar).
 *
 * The bar is fixed at the foot of the screen (`<BottomDock>`, z-30) and on the Guests List the thumb row floats on it
 * (z-25). What opens IN FLOW under a pill near the bottom — the one Group list and its in-place editors — landed under
 * them; a PickMenu list (portaled, z-95) drew OVER them. Both now read the screen's clear band from here:
 *
 *   · the bars are every fixed / sticky box on the page (as `measureRouteBottomChrome` finds them), MINUS those under the
 *     thing we show: inside a fixed layer above them (the guest card's phone sheet, z-75, covers the dock) a lower bar
 *     covers nothing, so it is not counted;
 *   · the floor is also the iPhone keyboard's edge while it is up (the one reading, `lib/keyboard-ride.ts`).
 *
 * `revealAboveChrome` scrolls a box's own scroller into that band; `pickViewport` hands a PickMenu its floor.
 */
import { bottomChromeLift, revealDelta, topChromeDrop, type ChromeBox } from '@/lib/bottom-chrome';
import { visibleBottom } from '@/lib/keyboard-ride';

const zOf = (el: Element) => parseInt(getComputedStyle(el).zIndex, 10) || 0;

/** The fixed layer `el` sits in (the phone sheet), if any. */
function layerOf(el: Element): Element | null {
  for (let n: Element | null = el; n; n = n.parentElement) if (getComputedStyle(n).position === 'fixed') return n;
  return null;
}

/** The band of the screen `own` can be seen in: below every bar stuck to the top, above every bar at the foot. */
export function clearBand(own: Element, skip?: Element | null): { top: number; bottom: number } {
  const vh = window.innerHeight;
  const layer = layerOf(own);
  const boxes: ChromeBox[] = [];
  for (const el of document.querySelectorAll<HTMLElement>('[class*="fixed"], [class*="sticky"], [data-bottom-dock]')) {
    if (el === layer || el.contains(own) || own.contains(el) || skip?.contains(el)) continue;
    const cs = getComputedStyle(el);
    if (cs.position !== 'fixed' && cs.position !== 'sticky') continue;
    if (cs.visibility === 'hidden' || cs.display === 'none') continue;
    // Under the layer we show in (the dock under the card's sheet): it covers nothing of ours.
    if (layer && !layer.contains(el) && zOf(el) < zOf(layer)) continue;
    boxes.push(el.getBoundingClientRect());
  }
  const screenBottom = visibleBottom();
  return { top: topChromeDrop(boxes, vh), bottom: Math.min(screenBottom, vh - bottomChromeLift(boxes, vh)) };
}

/** The box that scrolls `el` — its nearest scrolling ancestor, else the page. */
function scrollerOf(el: Element): Element | null {
  for (let n = el.parentElement; n; n = n.parentElement) {
    const o = getComputedStyle(n).overflowY;
    if ((o === 'auto' || o === 'scroll' || o === 'overlay') && n.scrollHeight > n.clientHeight) return n;
  }
  return null;
}

/**
 * Scroll `el` into the clear band — above the bottom bar and the keyboard, below a stuck top bar. `from` (the pill that
 * opened it) is the top to keep in view when it all cannot fit.
 */
export function revealAboveChrome(el: Element | null | undefined, from?: Element | null): number {
  if (!el || typeof window === 'undefined') return 0;
  const r = el.getBoundingClientRect();
  const top = from ? Math.min(r.top, from.getBoundingClientRect().top) : r.top;
  const band = clearBand(el);
  const scroller = scrollerOf(el);
  if (scroller) {
    const s = scroller.getBoundingClientRect();
    band.top = Math.max(band.top, s.top);
    band.bottom = Math.min(band.bottom, s.bottom);
  }
  const by = revealDelta({ top, bottom: r.bottom }, band);
  if (!by) return 0;
  const behavior = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth';
  (scroller ?? window).scrollBy({ top: by, behavior });
  return by;
}

/** A PickMenu's room: the screen, with its `floor` at the bottom bar's top (the open list is never its own bar). */
export function pickViewport(button: Element | null, list: Element | null) {
  const height = window.innerHeight;
  return { width: window.innerWidth, height, floor: button ? clearBand(button, list).bottom : height };
}
