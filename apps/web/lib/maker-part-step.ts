/**
 * ↑ ↓ THE PART ABOVE / BELOW (owner 2026-10-07: *"like in a keyboard when you press down it will just go highlight
 * the next element under it so we can edit that one"*). The shipped swipe step (`makerStepPart`, `stage-tools.tsx`)
 * walks these: the page's parts in their VISUAL order, measured on the canvas, top first.
 */
/** Parts sorted by where they sit on the page; a part not drawn here (null top) is left out. */
export function partsInPageOrder<K extends string>(parts: readonly K[], topOf: (k: K) => number | null): K[] {
  return parts
    .map((k, i) => ({ k, i, t: topOf(k) }))
    .filter((x): x is { k: K; i: number; t: number } => x.t !== null)
    .sort((a, b) => a.t - b.t || a.i - b.i)
    .map((x) => x.k);
}
