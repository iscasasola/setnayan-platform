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
 *     (`[data-popup-clear]` — Studio › Look's sample wears it);
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

/** The first live preview with something on screen — its box, or null. Read once per open (and on a resize); never polled. */
export function popupClearRect(doc: Pick<Document, 'querySelectorAll'>): Box | null {
  for (const el of Array.from(doc.querySelectorAll(`[${POPUP_CLEAR_ATTR}]`))) {
    const r = el.getBoundingClientRect();
    if (r.width > 0 && r.height > 0) return { left: r.left, top: r.top, right: r.right, bottom: r.bottom };
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
