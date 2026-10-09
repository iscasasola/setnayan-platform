/**
 * lib/popup-behind.ts — WHAT IS BEHIND A POP-UP: DARK, BLURRED, AND OUT OF REACH —
 * EXCEPT A LIVE PREVIEW, WHICH STAYS CLEAR.
 *
 * Owner, 2026-10-08 (`INTERACTION_RULES.md` § 9, "Anything popped up over the
 * page"): *"when there is a pop up. the rest of the screen darkens (except for
 * when there is preview) i think you know what I mean. The darkened area will be
 * blurred and nothing behind it will work. pressing on the dark part removes the
 * pop up. the background will not be scrollable when darkened blurred"*.
 *
 * Three small things a pop-up needs, with no component in them (the Maker's
 * sheet, `MakerSheet`, is the first to use them):
 *   · `inertBehind` — nothing behind works: every branch of the page that does
 *     not hold the pop-up is made `inert` (no tap, no focus, not read out), and
 *     put back exactly as it was;
 *   · `popupClearRect` — the live preview on screen, if there is one
 *     (`[data-popup-clear]` — Studio › Look's sample wears it): the box of what
 *     SHOWS of it, never the part of its box that lies under something else
 *     (`visibleBox`);
 *   · `popupHolePath` — the dark layer's `clip-path` with that preview cut out
 *     of it, so a pick in the sheet is SEEN at once.
 * The look of the dark itself is one CSS class, `.sn-popup-dark` (`globals.css`):
 * dark + blur, and dark alone where blur is not available or not wanted.
 *
 * Held by `lib/a-popup-darkens-what-is-behind.test.ts`.
 */

/** The mark a live preview wears to stay clear behind a pop-up. */
export const POPUP_CLEAR_ATTR = 'data-popup-clear';

type Box = { left: number; top: number; right: number; bottom: number };

/**
 * The dark layer's shape: the whole screen with `hole` cut out (`evenodd`), in px. Null = no hole to cut (nothing of
 * the preview is on screen) — the layer is then left whole.
 */
export function popupHolePath(hole: Box | null, viewport: { width: number; height: number }): string | null {
  if (!hole) return null;
  const { width: w, height: h } = viewport;
  if (!(w > 0) || !(h > 0)) return null;
  const l = Math.max(0, Math.round(hole.left));
  const t = Math.max(0, Math.round(hole.top));
  const r = Math.min(w, Math.round(hole.right));
  const b = Math.min(h, Math.round(hole.bottom));
  if (!(r > l) || !(b > t)) return null;
  return `polygon(evenodd, 0px 0px, ${w}px 0px, ${w}px ${h}px, 0px ${h}px, 0px 0px, ${l}px ${t}px, ${l}px ${b}px, ${r}px ${b}px, ${r}px ${t}px, ${l}px ${t}px)`;
}

/**
 * ONLY THE PREVIEW — the part of `box` where the preview is really what shows. A preview's own box can run on under
 * something drawn over it (the Maker's lower third lies over the foot of Look's sample: its box ended 144 px below
 * the last pixel of it anyone could see, and the tabs and the Source row over it were left bright — controller,
 * 2026-10-08, measured on the review copy). So the box is tightened to what `shows(x, y)` says — the browser's own
 * hit test, asked along the box's middle column, then along the middle row of what that found.
 * Null = the preview shows nowhere along its middle: no hole is cut.
 */
export function visibleBox(box: Box, shows: (x: number, y: number) => boolean, step = 4): Box | null {
  /** The longest unbroken stretch of [from, to) where `at(v)` holds — its two ends, to the pixel. */
  const run = (from: number, to: number, at: (v: number) => boolean): [number, number] | null => {
    let best: [number, number] | null = null;
    let start: number | null = null;
    let last = from;
    for (let v = from + 0.5; v < to; v += step) {
      if (at(v)) {
        if (start === null) start = v;
        last = v;
      } else if (start !== null) {
        if (!best || last - start > best[1] - best[0]) best = [start, last];
        start = null;
      }
    }
    if (start !== null && (!best || last - start > best[1] - best[0])) best = [start, last];
    if (!best) return null;
    let [a, b] = best;
    /* The scan stepped over the edges: walk each end out, a pixel at a time, to where it stops holding. */
    while (a - 1 >= from && at(a - 1)) a -= 1;
    while (b + 1 < to && at(b + 1)) b += 1;
    return [Math.floor(a), Math.ceil(b)];
  };
  const cx = (box.left + box.right) / 2;
  const rows = run(box.top, box.bottom, (y) => shows(cx, y));
  if (!rows) return null;
  const cy = (rows[0] + rows[1]) / 2;
  const cols = run(box.left, box.right, (x) => shows(x, cy));
  if (!cols) return null;
  return { left: Math.max(box.left, cols[0]), top: Math.max(box.top, rows[0]), right: Math.min(box.right, cols[1]), bottom: Math.min(box.bottom, rows[1]) };
}

/**
 * The first live preview with something on screen — the box of what SHOWS of it, or null. `popup` is the pop-up
 * asking: its own layers lie over everything and are looked through. Read once per open (and on a resize); never
 * polled.
 * ⚠ ASK BEFORE `inertBehind`: an inert branch answers no hit test, so the preview would seem to show nowhere.
 */
export function popupClearRect(doc: Pick<Document, 'querySelectorAll' | 'elementsFromPoint'>, popup: { contains(other: Element): boolean } | null = null): Box | null {
  for (const el of Array.from(doc.querySelectorAll(`[${POPUP_CLEAR_ATTR}]`))) {
    const r = el.getBoundingClientRect();
    if (!(r.width > 0 && r.height > 0)) continue;
    const shows = (x: number, y: number) => {
      for (const hit of doc.elementsFromPoint(x, y)) {
        if (popup?.contains(hit)) continue;
        return el.contains(hit);
      }
      return false;
    };
    return visibleBox({ left: r.left, top: r.top, right: r.right, bottom: r.bottom }, shows);
  }
  return null;
}

/** Only what `inertBehind` touches of an element — so it can be driven without a browser. */
type Node = {
  tagName: string;
  parentElement: Node | null;
  children: ArrayLike<Node>;
  hasAttribute(name: string): boolean;
  setAttribute(name: string, value: string): void;
  removeAttribute(name: string): void;
};

/** Never worth marking: they draw nothing and take no input. */
const SKIP = new Set(['SCRIPT', 'STYLE', 'LINK', 'TEMPLATE', 'NOSCRIPT']);

/**
 * NOTHING BEHIND WORKS. Walking up from the pop-up to <body>, every sibling on the way is made `inert`. Returns the
 * undo, which takes `inert` off ONLY where this call put it — a branch that was already inert (another pop-up
 * underneath, a closed drawer) stays as it was.
 */
export function inertBehind(popup: Node): () => void {
  const made: Node[] = [];
  let node: Node | null = popup;
  while (node && node.parentElement && node.tagName !== 'BODY') {
    const parent: Node = node.parentElement;
    for (const sib of Array.from(parent.children)) {
      if (sib === node || SKIP.has(sib.tagName) || sib.hasAttribute('inert')) continue;
      sib.setAttribute('inert', '');
      made.push(sib);
    }
    node = parent;
  }
  return () => {
    for (const el of made.splice(0)) el.removeAttribute('inert');
  };
}
