// Creator "Adventure Chapter" teaser — CLIENT-SAFE constants + plan types.
//
// PURE DATA + TYPES. No DB, no network, no 'server-only'. The client render
// orchestrator (teaser-generator.tsx) imports the brand constants from here;
// the server plan builder (lib/creator-teaser.ts) re-exports everything so
// server callers keep a single import point. Split out because
// lib/creator-teaser.ts pulls server-only readers (papic-gallery →
// uploads → 'server-only') that must never reach a client bundle — the same
// pattern lib/stories-templates.ts documents for the Guest Stories renderer.

import type { BeatGrid } from './stories-templates';

/** Target teaser length — a "few seconds". */
export const TEASER_TARGET_SEC = 6;
/** A teaser needs enough frames to read as a montage, not a slideshow. */
export const TEASER_MIN_PHOTOS = 3;
/** Cap so a 100-photo gallery still yields a tight few-second cut. */
export const TEASER_MAX_PHOTOS = 8;
/** The "made with Setnayan" hook, baked into every frame + the end card. */
export const TEASER_FOOTER = 'Made with Setnayan';
/** Brand palette (obsidian · gold · mulberry · black) for the render template. */
export const TEASER_PALETTE: readonly [string, string, string, string] = [
  '#0F0F0F',
  '#C9A14B',
  '#8B1E3F',
  '#000000',
];

export type TeaserPlanPhoto = { clipId: string; url: string };

export type TeaserPlan = {
  canRender: boolean;
  /** Human-readable reason the teaser can't be built yet (null when it can). */
  reason: string | null;
  photos: TeaserPlanPhoto[];
  /** Presigned owned-catalogue track URL, or null → the teaser renders silent. */
  musicUrl: string | null;
  beatGrid: BeatGrid | null;
  musicLabel: string | null;
  targetSec: number;
};
