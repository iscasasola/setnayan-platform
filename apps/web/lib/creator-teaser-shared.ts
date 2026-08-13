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
/**
 * How long the rigid "Made with Setnayan" end card holds, in seconds.
 *
 * 🚨 THIS EXISTS BECAUSE THE END CARD WAS EATING THE FILM. The beat scheduler
 * gives its LAST source everything remaining, and the end card is appended
 * last, so its slot was however much time the photos left over: ~2.5s of a 6s
 * film (42%), and ~27s of a 30s one. Pinning it means the photos absorb the
 * remainder instead — which is what a montage is.
 */
export const TEASER_END_CARD_SEC = 1.6;
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
