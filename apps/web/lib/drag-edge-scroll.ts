/**
 * apps/web/lib/drag-edge-scroll.ts
 *
 * ✋ ONE SHARED DRAG-AND-DROP WITH EDGE SCROLL FOR EVERY LIST (owner 2026-11-01, DECISION_LOG row of that name):
 * *"for both list and march, when we pick someone up and drag in on the top, the normal tendency is to scroll the list
 * so i can see the other places above it. this is a standard navigation rule on drag and drop"*.
 *
 * THE ONE PLACE the "list scrolls by itself near its edge" rule lives. Before this file there were three copies of the
 * math — the Maker's scene drag (`lib/maker-scene-drag.ts › sceneEdgeScroll`), the Wedding March
 * (`details-march.tsx`, `scrollerOf` + its own loop) and the RSVP stage's line drag (`rsvp-canvas-drag.ts`, the March's
 * formula typed again). Each now asks this file; `one-drag-edge-scroll.test.ts` fails if a second copy comes back.
 *
 * HOW A LIST USES IT (Seats › List, Guests › List and every later drag do the same):
 *   1. press and hold to lift (each drag keeps its own hold time — the March 250 ms, a scene or a reply line 350 ms),
 *      and the "tap · move" fallback stays beside it;
 *   2. at the lift, find what scrolls the list — `dragScrollerOf(el)`: its own box if it scrolls inside one, else
 *      the whole page (of the element's own document, so a Maker frame scrolls its own page);
 *   3. every animation frame while held: `v = dragEdgeStep(y, dragBandOf(scroller), reach)`; if `v`, `dragScrollBy`.
 *      Negative = up. Near the edge it scrolls; the nearer the edge, the faster.
 *
 * Pure math first (executed by the guard), then the three small DOM helpers.
 */

/** How far in from a list's top or bottom edge a held finger makes it scroll by itself (both shipped drags: 56). */
export const DRAG_EDGE_PX = 56;
/** The slowest it scrolls, px per frame — at the band's inner line. A first step of 1 px reads as stuck. */
export const DRAG_EDGE_MIN_STEP = 4;
/** The fastest it scrolls, px per frame — the finger at (or past) the edge. A drag may ask for less (`reach.max`). */
export const DRAG_EDGE_MAX_STEP = 18;
/** A finger this far PAST the edge (over a header above a list's box, past its foot) still scrolls it. */
export const DRAG_EDGE_PAST_PX = 40;

/** The list's visible top and bottom, in the same coordinates as the finger (the viewport's). */
export type DragEdgeBand = { top: number; bottom: number };

/** What one drag changes about the rule — never the curve itself. */
export type DragEdgeReach = {
  /** Fastest step for this drag (default `DRAG_EDGE_MAX_STEP`). */
  max?: number;
  /** How far above the band's top a finger still scrolls up (default `DRAG_EDGE_PAST_PX`; `Infinity` = anywhere above). */
  pastTop?: number;
  /** How far below the band's bottom a finger still scrolls down (default `DRAG_EDGE_PAST_PX`; 0 = only inside the band). */
  pastBottom?: number;
  /** The bottom band does not scroll right now (the Maker's bin stands in it). */
  bottomOff?: boolean;
};

/** How fast, `into` px into the edge band: rises steadily from the band's inner line to the edge, then holds. */
function edgeSpeed(into: number, max: number): number {
  return Math.min(max, Math.round(DRAG_EDGE_MIN_STEP + Math.max(0, into) / 4));
}

/**
 * HOW FAR THE LIST SCROLLS BY ITSELF THIS FRAME (px; negative = up; 0 = it stays) with the finger at `y`.
 * Within `DRAG_EDGE_PX` of an edge it scrolls toward that edge, faster the nearer — and on past the edge for the
 * drag's `past` reach (a finger over the header above a list still means "further up").
 */
export function dragEdgeStep(y: number, band: DragEdgeBand, reach: DragEdgeReach = {}): number {
  const max = reach.max ?? DRAG_EDGE_MAX_STEP;
  const pastTop = reach.pastTop ?? DRAG_EDGE_PAST_PX;
  const pastBottom = reach.pastBottom ?? DRAG_EDGE_PAST_PX;
  const upLine = band.top + DRAG_EDGE_PX;
  const downLine = band.bottom - DRAG_EDGE_PX;
  if (y < upLine && y > band.top - pastTop) return -edgeSpeed(upLine - y, max);
  if (!reach.bottomOff && y > downLine && y < band.bottom + pastBottom) return edgeSpeed(y - downLine, max);
  return 0;
}

/* ── the DOM side: what scrolls, where its edges are, and the scroll itself ─────────────────────────────────────── */

const pageOf = (doc: Document): HTMLElement => (doc.scrollingElement as HTMLElement | null) ?? doc.documentElement;

/** What scrolls the list `el` is in: the nearest box that scrolls (and has more to show), else the whole page. */
export function dragScrollerOf(el: Element): HTMLElement {
  const doc = el.ownerDocument;
  const win = doc.defaultView;
  for (let p = el.parentElement; p; p = p.parentElement) {
    if (p === doc.body || p === doc.documentElement) break;
    const oy = win?.getComputedStyle(p).overflowY;
    if ((oy === 'auto' || oy === 'scroll') && p.scrollHeight > p.clientHeight) return p;
  }
  return pageOf(doc);
}

/** Is this scroller the whole page (rather than a box of its own)? */
function isPage(scroller: HTMLElement): boolean {
  const doc = scroller.ownerDocument;
  return scroller === doc.scrollingElement || scroller === doc.documentElement || scroller === doc.body;
}

/** The scroller's visible top and bottom on the screen — clamped to the screen (a tall box may run past it). */
export function dragBandOf(scroller: HTMLElement): DragEdgeBand {
  const h = scroller.ownerDocument.defaultView?.innerHeight ?? 0;
  if (isPage(scroller)) return { top: 0, bottom: h };
  const r = scroller.getBoundingClientRect();
  return { top: Math.max(0, r.top), bottom: Math.min(h, r.bottom) };
}

/** Scroll it by `v` px — the page through its window (so a Maker frame scrolls its own page), a box by its own top. */
export function dragScrollBy(scroller: HTMLElement, v: number): void {
  if (!v) return;
  if (isPage(scroller)) scroller.ownerDocument.defaultView?.scrollBy(0, v);
  else scroller.scrollTop += v;
}
