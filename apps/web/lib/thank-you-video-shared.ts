// Thank-You Video — CLIENT-SAFE constants + plan types.
//
// PURE DATA + TYPES. No DB, no network, no 'server-only'. The client render
// orchestrator imports from here; the server plan builder (lib/thank-you-video.ts)
// re-exports everything so server callers keep one import point.
//
// 🪤 THE SPLIT IS LOAD-BEARING, NOT TIDINESS. lib/thank-you-video.ts pulls
// papic-gallery → uploads → 'server-only'. A client component importing the
// builder's module directly does not fail at runtime with a useful message — it
// fails the BUILD, and only under `next build` (CI's `tsc` does not model the
// RSC boundary). Same reason lib/creator-teaser-shared.ts and
// lib/stories-templates.ts exist.

import type { BeatGrid } from './stories-templates';

/**
 * Target length. Longer than the creator teaser's 6s hook because this is a
 * keepsake a couple sends to the people who came, not an advert — but still
 * inside the 30-second ceiling every Setnayan-rendered reel shares
 * (RECAP_MAX_DURATION_MS, owner 2026-06-28).
 */
export const THANK_YOU_TARGET_SEC = 20;

/** Below this it reads as an accident rather than a thank-you. */
export const THANK_YOU_MIN_PHOTOS = 6;

/**
 * Cap. At 20s a 20-photo cut gives each frame ~1s, which is the floor at which
 * a face is still readable. More photos would make it a strobe, not a montage.
 */
export const THANK_YOU_MAX_PHOTOS = 20;

/** Footer baked into every frame — the same brand seam the other reels carry. */
export const THANK_YOU_FOOTER = 'Made with Setnayan';

/**
 * Terracotta palette — the 2026-08-04 lock (cream · ink · CTA · gold).
 * ⚠ NOT the creator teaser's obsidian/gold set: that one is deliberately
 * off-palette brand chrome for a creator's own audience. This film is the
 * couple's, and it must look like the rest of their wedding.
 */
export const THANK_YOU_PALETTE: readonly [string, string, string, string] = [
  '#FDFBF7', // cream
  '#2C2A29', // ink
  '#C24E25', // CTA terracotta
  '#A9834B', // gold
];

export type ThankYouPlanPhoto = { clipId: string; url: string };

/**
 * The whole RULE — pure, and living here on purpose.
 *
 * 🔑 WHY THIS IS NOT IN THE SERVER MODULE. `lib/thank-you-video.ts` carries
 * `import 'server-only'`, which makes it unrunnable under `tsx --test`. Its
 * sibling `lib/creator-teaser.ts` keeps the identical min/cap/reason logic
 * inside the server module — and has NO TEST AT ALL, which is not a coincidence:
 * a rule that cannot be imported does not get asserted. Splitting the decision
 * out leaves the server module a thin reader and puts the part that can be
 * WRONG (the floor, the cap, and the sentence a couple reads) under test.
 *
 * Takes frames already filtered to public-safe by the caller — this function
 * cannot see consent and must never be asked to judge it.
 */
export function planFromFrames(
  frames: readonly ThankYouPlanPhoto[],
): {
  canRender: boolean;
  reason: string | null;
  photos: ThankYouPlanPhoto[];
  availableCount: number;
} {
  const availableCount = frames.length;
  const photos = frames.slice(0, THANK_YOU_MAX_PHOTOS);
  if (photos.length < THANK_YOU_MIN_PHOTOS) {
    return {
      canRender: false,
      photos: [],
      availableCount,
      // Plain English, and it names the REAL constraint. "No photos yet" would
      // be a lie when the gallery is full of shots nobody agreed to share, and
      // it would send the couple looking for a problem that isn't there.
      reason:
        `You need at least ${THANK_YOU_MIN_PHOTOS} photos that are cleared to share publicly — ` +
        `there ${availableCount === 1 ? 'is' : 'are'} ${availableCount} so far. ` +
        `Guest photos only count once the guest has agreed to share them and you have approved them.`,
    };
  }
  return { canRender: true, reason: null, photos, availableCount };
}

export type ThankYouPlan = {
  canRender: boolean;
  /** Plain-English reason it cannot be built yet (null when it can). */
  reason: string | null;
  photos: ThankYouPlanPhoto[];
  /** How many public-safe frames existed before the cap — for honest copy. */
  availableCount: number;
  /** Presigned owned-catalogue track URL, or null → renders silent. */
  musicUrl: string | null;
  beatGrid: BeatGrid | null;
  musicLabel: string | null;
  targetSec: number;
};
