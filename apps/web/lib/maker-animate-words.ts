/* The words Animate's rows and ▶'s status say — a module of its own, so a file that may load first (`play-status.tsx`)
   never pulls Animate's classes (`lib/maker-animate-rows.ts`, `animate-is-four-rows.test.ts`). */
/**
 * 🎬 ANIMATE'S WORDS (owner 20 Nov 2026, DECISION_LOG "MAKER TABS REVISITED" (3): *"Arrives · While showing · Leaves · With
 * the scroll"* — they replace Build in · Action · Build out · Scene leaves, where "Build out" and "Scene leaves" both meant
 * leaving). The stored keys (`in` · `act` · `out`) are unchanged; only what a couple reads.
 */
export const MAKER_ANIMATE_WORDS = { in: 'Arrives', act: 'While showing', out: 'Leaves', scroll: 'With the scroll' } as const;
/** ▶ Picking a motion plays it on the page at once (the same 20 Nov row): Animate asks; the toolbar plays the picked part. */
export const MAKER_PLAY_PICKED_EVENT = 'maker:play-picked';
export function playPickedSoon(): void {
  if (typeof window !== 'undefined') window.setTimeout(() => window.dispatchEvent(new Event(MAKER_PLAY_PICKED_EVENT)), 120);
}
