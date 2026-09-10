/**
 * story-reader-position.ts — where the reader is in the story, published once.
 *
 * `01_The_Story.md` §1 + §3.4 · `08` steps 2.1–2.3.
 *
 * ── WHY THIS EXISTS AT ALL ─────────────────────────────────────────────────
 * The dial's needle, the "now" readout, the light on the page and the room in
 * the lens are FOUR VIEWS OF ONE FACT: which entry the reader has reached, and
 * how far through it they are. `story-clock.tsx` says it plainly about the
 * first three — *"the needle, the readout and the entry being read are the same
 * fact asked three ways. Splitting them is how two of them end up disagreeing."*
 *
 * S10 adds the fourth and fifth. They cannot live inside that component — the
 * light paints the document root and the lens is a sticky aside beside the
 * entries, neither of which is inside the dial's subtree — so the alternative
 * was a SECOND `requestAnimationFrame` loop reading the same
 * `getBoundingClientRect`s. Two loops means two answers: the needle on one
 * minute while the room shows another, drifting apart under load, and two lots
 * of layout per frame on a page that is already 16,000px long.
 *
 * So: ONE loop, in the clock, publishing here. This module is a postbox, not a
 * store — no React, no state library, no context. The same shape
 * `living-moments.tsx` already uses for the "only one clip audible" rule, and
 * for the same reason: a module-level registry is the only thing two unrelated
 * subtrees can both reach without a provider wrapped around the whole page.
 *
 * ⚠ THE LAST POSITION IS REPLAYED TO A LATE SUBSCRIBER. The lens and the light
 * mount independently of the clock, and a subscriber that arrives one frame
 * after the first publish would otherwise sit on its server-rendered opening
 * state until the reader happened to scroll. On a story opened at a deep link
 * that is the whole visit.
 */

/** Where the reader is. `null` entry = above the first entry, on the cover. */
export type ReaderPosition = {
  /** The entry the reader has reached, or null on the cover. */
  entry: HTMLElement | null;
  /** The entry after it, if there is one — the crossfade's other end. */
  next: HTMLElement | null;
  /** 0…1 through the current entry. */
  progress: number;
};

type Listener = (pos: ReaderPosition) => void;

const listeners = new Set<Listener>();
let last: ReaderPosition | null = null;

/**
 * Publish the reader's position. Called by the clock's own scroll loop, and by
 * nothing else — a second publisher is a second opinion about where the reader
 * is, which is the thing this module exists to prevent.
 */
export function publishReaderPosition(pos: ReaderPosition): void {
  last = pos;
  for (const fn of listeners) {
    try {
      fn(pos);
    } catch {
      /*
        One subscriber throwing must not stop the others. The light and the lens
        are independent readings of the same fact; a bug in the room has no
        business freezing the page's colour on whatever it happened to be.
      */
    }
  }
}

/** Subscribe. The current position is replayed immediately if there is one. */
export function subscribeReaderPosition(fn: Listener): () => void {
  listeners.add(fn);
  if (last) {
    try {
      fn(last);
    } catch {
      /* as above */
    }
  }
  return () => {
    listeners.delete(fn);
  };
}

/**
 * Forget the last position.
 *
 * Called when the clock unmounts — a client-side navigation away from the story
 * and back would otherwise replay the position of the PREVIOUS story's entries
 * to a fresh set of subscribers, painting one couple's night over another
 * couple's morning until the first scroll.
 */
export function clearReaderPosition(): void {
  last = null;
}
