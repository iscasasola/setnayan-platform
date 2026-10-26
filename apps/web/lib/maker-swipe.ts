/**
 * lib/maker-swipe.ts — 👉 A SIDEWAYS SWIPE ON THE STAGES TOOLBAR STEPS TO THE NEXT PART — UNLESS IT IS A ROW'S OWN SCROLL.
 *
 * The toolbar's swipe (`stage-tools.tsx`, the approved prototype's rule: a clear sideways move — right = the next
 * part) listens on the whole panel. A row that SCROLLS sideways under the thumb is the couple moving along that row,
 * never a step: the Style carousel was left out of the swipe from its first day (`[data-style-carousel]`), but the
 * Background tool's row of picture tiles (`stage-background.tsx`, row 2 — "ONE row of small pictures swiped
 * sideways", 2026-10-09) never was. Owner, live on his phone 2026-10-26: *"when changing some background color … it
 * does not stay on that screen. the background is not changeable to video, sotck videos/photos or upload photo"* — a
 * swipe along the tiles, to reach the colour, the loops, the scenes or his uploads, stepped the toolbar to the part
 * beside it (the canvas jumped to that part's page; its Background tool is grey), so the other tiles could never be
 * reached. Measured in `/dev/maker-lab`: a drag along the Schedule scene's Video tiles landed on Home › Closing.
 *
 * 🔑 THE RULE IS A PROPERTY, NOT A LIST: a move that starts inside an element that scrolls sideways (its own
 * `overflow-x` is auto/scroll and it has more than it shows), between the target and the panel, is that row's —
 * whatever the row is called. The named marks stay too (a row that does not overflow yet — the five Colour tiles on a
 * wide phone — is still a row of choices, and a drag along it must not throw the couple off it).
 *
 * Pure (an element is anything with `closest` and `parentElement`); the browser's own sideways test is handed in.
 * Held by `the-background-tiles-keep-the-toolbar-in-place.test.ts`.
 */

/** Where the swipe listens: the toolbar and the phone's panel under it. */
export const MAKER_SWIPE_PANEL = '[data-stage-tools], [data-phone-chrome="panel"]';

/**
 * What a swipe never starts on: a field, a slider, an open dropdown or sheet — and every row of choices that is moved
 * along sideways (the Style carousel; the Background tool's picture tiles, `data-stage-bg-strip`).
 */
export const MAKER_SWIPE_SKIP =
  'input, textarea, select, [role="slider"], [data-style-carousel], [data-stage-bg-strip], [data-maker-sheet], [aria-expanded="true"]';

/** The little of an element the rule reads. */
export type SwipeElement = { closest(selector: string): SwipeElement | null; parentElement: SwipeElement | null };

/**
 * May a sideways move that STARTS on `target` step the toolbar to the next part?
 * `scrollsSideways(el)`: the element scrolls sideways (in the browser — `swipeScrollsSideways`).
 */
export function swipeMayStep(target: SwipeElement | null, scrollsSideways: (el: SwipeElement) => boolean): boolean {
  if (!target) return false;
  const panel = target.closest(MAKER_SWIPE_PANEL);
  if (!panel) return false;
  if (target.closest(MAKER_SWIPE_SKIP)) return false;
  for (let el: SwipeElement | null = target; el && el !== panel; el = el.parentElement) {
    if (scrollsSideways(el)) return false;
  }
  return true;
}

/** The browser's sideways test: its own `overflow-x` scrolls and it holds more than it shows. */
export function swipeScrollsSideways(el: Element): boolean {
  if (el.scrollWidth <= el.clientWidth + 1) return false;
  const x = getComputedStyle(el).overflowX;
  return x === 'auto' || x === 'scroll';
}
