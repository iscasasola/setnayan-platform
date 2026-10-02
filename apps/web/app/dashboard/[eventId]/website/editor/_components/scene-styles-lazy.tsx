'use client';

import dynamic from 'next/dynamic';
import { SlotRows } from '../../../launch/_components/lazy-slot';

/**
 * ⚡ THE STYLE ROWS AND THE POST EVENT PANEL LOAD WHEN THEY ARE FIRST OPENED —
 * NEVER WITH THE MAKER.
 *
 * Owner, 2026-09-29: *"the Maker must never be slow"* — its first-load
 * JavaScript has a ceiling (`scripts/check-maker-js-budget.mjs`, 505KB gz).
 * Folding the scene styles and Post Event onto main put a scene's Style row,
 * the fixed parts' Style row and the whole Post Event scene panel into the code
 * a phone downloads before its first tap (511.5KB) — although each is drawn only
 * after a scene is tapped. These stand-ins keep the SAME names and props; each
 * loads its real piece the first time it renders.
 *
 * 📦 They travel in the EXISTING `maker-details` chunk (`launch/_components/
 * details-lazy.tsx`), never a new one: webpack's runtime — on EVERY page, under
 * the shared-bundle ceiling (`scripts/check-bundle-size.mjs`) — grows an entry
 * per async chunk, and the shared bundle had 0.1KB of headroom. The Maker
 * warms these pieces when it is idle (`launch/_components/maker-tools.tsx`),
 * so a tap almost never sees the slot.
 *
 * The Post Event stage's "+" is the shipped picker itself (first screen); its
 * twelve preset tiles (`post-event-preset-tiles.tsx`, with the presets' words)
 * load in this same chunk when the sheet opens.
 *
 * What stays in the first load, on purpose: the navigator's Post Event tile
 * words (`post-event-tile-words.ts`) — the rows are on the first screen.
 */
export const SceneStyleCanvasRow = dynamic(
  () => import(/* webpackChunkName: "maker-details" */ './scene-style-row').then((m) => m.SceneStyleCanvasRow),
  { loading: SlotRows },
);
export const FixedSceneStyleRow = dynamic(
  () => import(/* webpackChunkName: "maker-details" */ './fixed-scene-style-row').then((m) => m.FixedSceneStyleRow),
  { loading: SlotRows },
);
export const PostEventScenePanel = dynamic(
  () => import(/* webpackChunkName: "maker-details" */ './post-event-scene-panel').then((m) => m.PostEventScenePanel),
  { loading: SlotRows },
);
export const PostEventWordsField = dynamic(
  () => import(/* webpackChunkName: "maker-details" */ './post-event-scene-panel').then((m) => m.PostEventWordsField),
  { loading: SlotRows },
);
/* Post Event's twelve preset tiles (drawn by `scene-template-picker.tsx`'s sheet). */
export const PresetTiles = dynamic(
  () => import(/* webpackChunkName: "maker-details" */ './post-event-preset-tiles').then((m) => m.PresetTiles),
  { loading: SlotRows },
);
