/**
 * 🎚 SCRUB — the numbers (owner 2026-10-09, approved on the prototype `review/scrub-prototype.html`: *"centered and at
 * the line both looks good"* → Centred; *"let it enter on the last 20% of the build out"*; *"them must be on the same
 * position to create that keynote like transistion"*; *"it entered when the previous element is not yet done"* →
 * the order is strict; *"if no build out, then animation will be under it"*).
 *
 * Pure: no document, no window. The engine (`hub-scrub-engine.ts`) measures the page and asks these; the guard
 * (`lib/scrub-is-a-held-hand-over.test.ts`) executes them. Every length is CSS pixels.
 *
 *   A HAND-OVER (an element that Leaves by Scrub and has a Build out, and the next element in the page):
 *     · the leaving one is HELD — centred on the screen if it can be held whole; if it is a list whose rows build one
 *       by one, or is taller than the room, it is scrolled through first and held when its BOTTOM is on the centre line;
 *     · the arrival is drawn IN THE SAME PLACE — never reaching above the leaving one's frame, and never with its own
 *       bottom above the centre line (so nothing after it can reach the centre before it is done);
 *     · the page stands still for the Build out (55 % of a screen of thumb travel), the arrival's Build in starting
 *       when the Build out is 80 % done and running its ordinary 22 %; an arrival with rows gets room for its heading
 *       to finish after the leaving one has completely gone;
 *     · two hand-overs with no scrolling between them are parted by a rest (30 % of a screen).
 */

export const SCRUB = {
  /** Thumb travel of a Build out at a hand-over, as a share of the screen's height. */
  out: 0.55,
  /** Where in that Build out the arrival's Build in begins. */
  enter: 0.8,
  /** Thumb travel of a Build in. */
  in: 0.22,
  /** The rest between two hand-overs that follow each other with no scrolling between. */
  rest: 0.3,
  /** Thumb travel of one row's (or part's) Build in once its top is on the centre line. */
  row: 90,
} as const;

export type ScrubLens = { out: number; enter: number; in: number; rest: number };
export function scrubLens(viewportH: number): ScrubLens {
  const out = Math.round(viewportH * SCRUB.out);
  return { out, enter: Math.round(out * SCRUB.enter), in: Math.round(viewportH * SCRUB.in), rest: Math.round(viewportH * SCRUB.rest) };
}

export type ScrubElement = {
  /** Its height on the page. */
  h: number;
  /** Its rows (or parts) build one by one — each as it reaches the centre line. */
  oneByOne: boolean;
};

/** Scrolled through rather than held whole: a one-by-one list at ANY window height, or anything taller than the room. */
export function scrubThrough(el: ScrubElement, room: number): boolean {
  return el.oneByOne || el.h > room;
}

export type ScrubPair = {
  /** Where the leaving element's top is held, from the top of the screen. */
  top: number;
  /** How long the page stands still for this hand-over (the rest before it not included). */
  len: number;
  /** The arrival's top, measured from the leaving element's BOTTOM (≤ 0: it is drawn over it). */
  up: number;
  /** How far what follows the pair starts below the arrival's bottom; it rises by this while the pair is held. */
  rise: number;
  /** The arrival's top on the screen while the pair is held. */
  arrivalTop: number;
};

/**
 * One hand-over's geometry. `centre`: the centre line, from the top of the screen. `topLine`: the top of the room an
 * element can be seen in (under the page's own bar). `room`: the most that can be held whole.
 */
export function scrubPair(leaving: ScrubElement, arrival: ScrubElement, v: { centre: number; topLine: number; room: number; lens: ScrubLens }): ScrubPair {
  const through = scrubThrough(leaving, v.room);
  /* HELD — centred, or (scrolled through first) with its bottom on the centre line. */
  const top = through ? v.centre - leaving.h : v.centre - leaving.h / 2;
  /* THE FRAME — all of an element held whole; the last stretch of one scrolled through, from the top of the room down. */
  const frame = through ? Math.min(leaving.h, Math.max(0, v.centre - v.topLine)) : leaving.h;
  const frameTop = top + (leaving.h - frame);
  const bottom = top + leaving.h;
  /* THE ARRIVAL IN IT — taller than the frame: tops together, and it runs on below. A list that fits: as high as the
     frame's top, but never with its bottom above the centre line. Otherwise: centres together in a centred frame,
     else ENDS together on the centre line. */
  const arrivalTop =
    arrival.h > frame ? frameTop : scrubThrough(arrival, v.room) ? Math.max(frameTop, v.centre - arrival.h) : through ? bottom - arrival.h : frameTop + (frame - arrival.h) / 2;
  const len = Math.max(v.lens.out, v.lens.enter + v.lens.in, arrival.oneByOne ? v.lens.out + v.lens.in / 2 : 0);
  return { top, len, up: arrivalTop - bottom, rise: Math.max(0, bottom - (arrivalTop + arrival.h)), arrivalTop };
}

/** Is the arrival already where IT will be held when this hand-over ends? Then its own hand-over needs a rest first. */
export function scrubNeedsRest(arrivalTopOnScreen: number, arrival: ScrubElement, v: { centre: number; room: number }): boolean {
  const own = scrubThrough(arrival, v.room) ? v.centre - arrival.h : v.centre - arrival.h / 2;
  return arrivalTopOnScreen <= own + 1;
}

export type ScrubMoment = {
  /** The leaving element's Build out, 0…1. */
  out: number;
  /** The arrival's Build in, 0…1 — nothing until the Build out is 80 % done. */
  in: number;
  /** May the arrival's rows begin? 0…1 — only once the leaving one has COMPLETELY gone (and its heading is in). */
  rows: number;
  /** What follows the pair: how much of its rise is still to come, 1…0. */
  below: number;
};

/** A hand-over at `t` px of thumb travel since the leaving element was held (`rest`: the px that are only a rest). */
export function scrubMoment(t: number, pair: Pick<ScrubPair, 'len'>, lens: ScrubLens, rest = 0): ScrubMoment {
  const clamp = (n: number) => Math.max(0, Math.min(1, n));
  const s = Math.max(0, Math.min(pair.len, t - rest));
  return { out: clamp(s / lens.out), in: clamp((s - lens.enter) / lens.in), rows: clamp((s - lens.out) / (lens.in / 2)), below: 1 - clamp(s / pair.len) };
}

/** An element nobody hands over to: its Build in runs from its top reaching the centre line — finished by the time it is held. */
export function scrubOwnIn(topOnScreen: number, centre: number, span: number): number {
  return Math.max(0, Math.min(1, (centre - topOnScreen) / Math.max(1, span)));
}

/**
 * A row (or part) builds as ITS top reaches the centre line — and never before the gate says its turn has come.
 * `toBottom`: how far its top is above its element's bottom. A row near the end has less travel than the usual span
 * before the element's bottom is on the line, so it takes what it has: EVERY row is complete by the time the element
 * can begin to leave (owner: "it never completed the schedule").
 */
export function scrubRow(topOnScreen: number, centre: number, gate: number, toBottom = Infinity): number {
  return Math.max(0, Math.min(1, gate, (centre - topOnScreen) / Math.max(1, Math.min(SCRUB.row, toBottom))));
}

/**
 * THE CLASS VOCABULARY of a page with a hand-over (`hub-scenes.tsx` `flow`) — exported for the stylesheet guards, as
 * `HUB_SCENE_CLASSES` is. Kept HERE, beside the renderer, so `lib/hub-scenes.ts` (a Maker first-load file) is untouched.
 */
export const HUB_SCRUB_CLASSES = ['hub-cell', 'hub-stage', 'hub-after', 'hub-below'] as const;
/** The page's own hold (`hub-scenes.tsx` `HubPageHold`): one pair a hand-over, around the page's whole column. */
export const HUB_PAGE_HOLD_CLASSES = ['hub-page-cell', 'hub-page-stage'] as const;
/** What a Scrub scene was drawn with before 2026-10-09 (the stacked run) and is NOT any more. */
export const HUB_SCRUB_RETIRED_CLASSES = ['hub-run', 'hub-scrub', 'hub-sp'] as const;
