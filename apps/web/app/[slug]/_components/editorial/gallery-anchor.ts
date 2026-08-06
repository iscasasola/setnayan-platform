// ============================================================================
// THE RECAP'S PHOTO RUN — which blocks render, and which one the Gallery tab
// lands on after the wedding.
// ============================================================================
//
// ── WHY THIS FILE EXISTS ────────────────────────────────────────────────────
// The event site's bottom bar has a Gallery slot. On the day it lands on the
// Live Photo Wall. After the day the wall is gone and the page IS the recap —
// so the slot has to land on the recap's own photographs.
//
// Two things must agree about that, and they live in different files:
//
//   1. `editorial-content.tsx` — WHERE the `#site-gallery` anchor is written.
//   2. `site-body.tsx`         — WHETHER the Gallery slot is drawn at all.
//
// If (2) says yes while (1) wrote no anchor, a guest taps Gallery and the page
// does not move. If (1) writes an anchor while (2) says no, the photographs are
// on the page with nothing pointing at them. Both halves therefore read THE
// SAME pure function here — the answer is derived once, not typed twice.
//
// ── AND WHY IT IS NOT SIMPLY "the recap always has photos" ──────────────────
// It does not. A couple whose date has passed with nothing uploaded and no
// Papic captures gets a recap with prose and no pictures. Drawing a Gallery tab
// for them would be a dead tab — and worse, it would ANNOUNCE that photographs
// exist. The site-nav resolver's rule 3 is explicit that content is HIDDEN, not
// greyed out; an "no photos yet" plate is exactly the thing that ruling forbids.
// So presence is a fact about what rendered, never a promise about the feature.
//
// Pure + client-safe (no `server-only`, no imports from `./data` beyond types),
// same posture as `editorial-order.ts`.

import type { EditorialOrderKey } from './editorial-order';

/** The reorderable blocks that put PHOTOGRAPHS on the recap. */
export type EditorialPhotoKey = Extract<EditorialOrderKey, 'chapters' | 'gallery' | 'liveWall'>;

/** Which photo blocks this edition actually draws. */
export type EditorialPhotoBlocks = {
  /**
   * The `chapters` slot has two shapes and one toggle: the living "As the Day
   * Unfolded" strip when there are day chapters, else the legacy "Moments"
   * essay. `null` when neither has anything.
   */
  chapters: 'living' | 'essay' | null;
  /** "From the Day" — the shared photo gallery. */
  gallery: boolean;
  /** "Live Photo Wall" — the LIVE_WALL add-on's dense masonry. */
  liveWall: boolean;
};

/**
 * The counts + toggles the three photo blocks are gated on. Deliberately
 * primitive (numbers and booleans, not the loaded arrays) so the caller cannot
 * pass a half-resolved `EditorialData` and so the unit test needs no fixture.
 */
export type EditorialPhotoInput = {
  /** `draft_json.sections`. A block shows unless its key is explicitly `false`. */
  sections?: Partial<Record<string, boolean>> | null;
  dayChapters: number;
  essayPhotos: number;
  galleryPhotos: number;
  photoWallActive: boolean;
  photoWallPhotos: number;
};

/**
 * Resolve the three photo blocks. Mirrors — and is now the ONLY statement of —
 * the gating that `editorial-content.tsx` applies to its `chapters`, `gallery`
 * and `liveWall` nodes.
 */
export function editorialPhotoBlocks(input: EditorialPhotoInput): EditorialPhotoBlocks {
  // "A block shows unless the couple turned it off in the editorial editor."
  const isOn = (k: string) => input.sections?.[k] !== false;
  const galleryToggle = isOn('gallery');
  return {
    chapters: galleryToggle
      ? input.dayChapters > 0
        ? 'living'
        : input.essayPhotos > 0
          ? 'essay'
          : null
      : null,
    gallery: galleryToggle && input.galleryPhotos > 0,
    liveWall: isOn('liveWall') && input.photoWallActive && input.photoWallPhotos > 0,
  };
}

/** Does this edition put ANY photograph on the page? */
export function editorialShowsPhotos(blocks: EditorialPhotoBlocks): boolean {
  return blocks.chapters !== null || blocks.gallery || blocks.liveWall;
}

/**
 * Which block carries the `#site-gallery` anchor: the FIRST photo block that
 * renders, in the couple's own saved section order. Following their order
 * matters — a couple who put the Live Photo Wall above "From the Day" expects
 * Gallery to land on the wall, not to scroll past it.
 *
 * `null` when this edition has no photographs, which is also the signal to the
 * bar not to draw the slot.
 */
export function editorialGalleryAnchorKey(
  blocks: EditorialPhotoBlocks,
  order: readonly EditorialOrderKey[],
): EditorialPhotoKey | null {
  for (const key of order) {
    if (key === 'chapters' && blocks.chapters !== null) return 'chapters';
    if (key === 'gallery' && blocks.gallery) return 'gallery';
    if (key === 'liveWall' && blocks.liveWall) return 'liveWall';
  }
  return null;
}
