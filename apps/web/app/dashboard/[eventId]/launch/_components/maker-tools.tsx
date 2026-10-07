'use client';

import type { PreloadJob } from '@/lib/app-preload';
import { warmDynamic, warmDynamicExports } from '@/lib/warm-dynamic';

/**
 * 🧰 THE MAKER'S TOOLS — EVERY PANEL THAT LOADS ON A TAP, IN ONE LIST.
 *
 * Owner, 2026-10-02 (DECISION_LOG "THE MAKER DOWNLOADS ALL ITS TOOLS RIGHT
 * AFTER IT OPENS — EVERY TAP IS INSTANT"): *"can you download the whole maker
 * once it loads?"* The Maker's first load stays under its ceiling
 * (`scripts/check-maker-js-budget.mjs`); everything a tap opens lives in a
 * chunk of its own, reached through a `next/dynamic` stand-in. Once the Maker
 * is on screen and the phone is idle, `MAKER_TOOLS` below is handed to the one
 * preload queue (`lib/app-preload.ts`) — each tool's chunk is downloaded AND
 * its stand-ins are warmed (`lib/warm-dynamic.ts`), so the first tap draws the
 * real panel in the same frame.
 *
 * 🛡 A TOOL CANNOT BE FORGOTTEN. `maker-tools-are-all-preloaded.test.ts` walks
 * everything the Maker's first load reaches and fails on any `import()` it
 * finds that no entry here covers (a stand-in module listed below covers every
 * `import()` inside it). Its two honest answers: add the tool here, or — if it
 * is not a tool (analytics, an upload's compressor) — give it a reasoned line
 * in that test's NOT_A_TOOL list.
 *
 * Order is priority: Details first (the most-opened, and the largest), the
 * stage's own panels next, then the pages Details hands in.
 *
 * 📦 IMPORTS NOTHING OF THE MAKER STATICALLY. Each tool's stand-in module is
 * reached by an `import()` into that tool's own EXISTING chunk
 * (`maker-details`, `maker-mood-board`, …) — on the Maker those modules are
 * already on the page, so it costs nothing, and the file stays free to be
 * loaded from anywhere without dragging the Maker page's chunks along. The
 * Love Story's live pieces are declared by the Maker's shell, not here, so their
 * chunk keeps the Maker's page as its only parent (`registerLiveLoveStory`).
 */

/* The Love Story's live pieces, as the Maker's shell declared them (see above). */
let liveLoveStory: readonly unknown[] = [];
export function registerLiveLoveStory(...pieces: unknown[]): void {
  liveLoveStory = pieces;
}

export type MakerTool = PreloadJob & {
  /** A short name for messages and the PR's inventory (it ships in the Maker's first load — keep it short). */
  readonly label: string;
};

/** Every tool panel of the Maker. A new lazy panel goes here, or the guard fails. */
export const MAKER_TOOLS: readonly MakerTool[] = [
  {
    key: 'maker:details',
    /* every item's editor and picture: Your event, Words, the prints, RSVP, Logo, Reveal, the scene editors, What's left */
    label: 'Details',
    load: () => import(/* webpackChunkName: "maker-details" */ './details-lazy').then(warmDynamicExports),
  },
  {
    key: 'maker:scene-styles',
    /* a scene's Style rows, the Post Event panel and its twelve preset tiles (+ Add a scene) */
    label: 'Scene styles',
    load: () => import(/* webpackChunkName: "maker-details" */ '../../website/editor/_components/scene-styles-lazy').then(warmDynamicExports),
  },
  {
    key: 'maker:love-story',
    label: 'Love Story',
    load: () =>
      liveLoveStory.length > 0 ? Promise.all(liveLoveStory.map(warmDynamic)) : Promise.reject(new Error('not on the Maker')),
  },
  {
    key: 'maker:love-story-cards',
    /* 🧭 Studio › Love Story's cards (`moment-order-cards-lazy.tsx`) — lazy so the Maker's first load stays within budget. */
    label: 'Love Story cards',
    load: () => import(/* webpackChunkName: "maker-details" */ '../../website/our-story/_components/moment-order-cards-lazy').then(warmDynamicExports),
  },
  {
    key: 'maker:colour-picker',
    /* 🎨 The ONE colour picker (the Mood Board's sheet) every Studio colour opens (owner 2026-10-08) — its first tap never waits. */
    label: 'Colour picker',
    load: () => import(/* webpackChunkName: "maker-details" */ './studio-colour-field').then(warmDynamicExports),
  },
  {
    key: 'maker:schedule',
    label: 'Schedule',
    load: () => import(/* webpackChunkName: "maker-schedule" */ '../../schedule/_components/schedule-lazy').then(warmDynamicExports),
  },
  {
    key: 'maker:mood-board',
    label: 'Mood Board',
    load: () => import(/* webpackChunkName: "maker-mood-board" */ '../../studio/mood-board/_components/mood-board-lazy').then(warmDynamicExports),
  },
  {
    key: 'maker:seating',
    label: 'Seat plan',
    load: () => import(/* webpackChunkName: "maker-seating" */ '../../seating/_components/seating-lazy').then(warmDynamicExports),
  },
  /* (The march's ↑↓ panel left on 2026-10-06 — the Wedding March is the drag maker,
     `details-march.tsx`, warmed with the Details pieces above.) */
  /* The Logo studio turns typed words into outlines with opentype.js — loaded by
     `maker-logo.tsx` when a word is drawn. The library only, never a font file
     or anything the couple uploaded. */
  { key: 'maker:logo-outlines', label: 'Logo outlines', load: () => import('opentype.js') },
  /* The couple's logo plays through `CoupleLogo`, which loads its player only
     when a logo plays (so a page of still logos ships none of it). Warmed here
     so a Maker Play never waits for the download. */
  { key: 'maker:logo-player', label: 'Logo player', load: () => import('@/app/_components/couple-logo').then(warmDynamicExports) },
];
