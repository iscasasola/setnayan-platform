// Creator "Adventure Chapter" — owned-music TEASER plan builder (CP-2).
//
// The teaser is a SHORT (a few-second) Setnayan-HOSTED vertical clip built from
// a chapter's own substrate photos (its Papic gallery) set to ONE
// Setnayan-owned music track, ending on a "Made with Setnayan" card. It is the
// shareable hook that pulls a creator's audience toward Setnayan — it is NOT
// the creator's full edit (that stays EMBEDDED on their own platform via
// `embed_url`; Setnayan never hosts it).
//
// This module assembles the render PLAN on the server (which photos, which
// owned track). The actual encode runs CLIENT-SIDE in the browser via
// lib/reel-render.ts (owner-locked render host: ₱0 server compute, no server
// ffmpeg/Remotion). Same shape as the Guest-Stories / Patiktok render path.
//
// OWNED MUSIC ONLY (hard line): the backing track is resolved EXCLUSIVELY from
// the Setnayan-owned `reel_music_tracks` catalogue (via pickOwnedReelMusic —
// `is_active` + NOT `is_premium`). There is NO creator-supplied / uploaded
// audio path in this render: the only audio source is this one server read, so
// no BYO audio can ever reach it.

import type { SupabaseClient } from '@supabase/supabase-js';
import type { BeatGrid } from './stories-templates';
import { fetchPapicGallery, type GalleryPhoto } from './papic-gallery';
import { pickOwnedReelMusic } from './guest-stories';

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

/**
 * The chapter's Papic gallery is keyed by the substrate's `papic_gallery_id`
 * (the event id whose gallery seeds the teaser). Returns null when unset.
 */
export function readChapterGalleryEventId(
  substrate: Record<string, unknown> | null | undefined,
): string | null {
  if (!substrate) return null;
  const v = (substrate as { papic_gallery_id?: unknown }).papic_gallery_id;
  return typeof v === 'string' && v.trim() ? v.trim() : null;
}

/**
 * Build the teaser render plan for a chapter. `supabase` MUST be the caller's
 * RLS-bound client — `fetchPapicGallery` runs under RLS, so a creator can only
 * pull frames from a Papic gallery they actually have access to (a foreign
 * event id simply returns no rows). Never throws — degrades to canRender:false.
 */
export async function buildChapterTeaserPlan(
  supabase: SupabaseClient,
  substrate: Record<string, unknown> | null | undefined,
): Promise<TeaserPlan> {
  const base = {
    photos: [] as TeaserPlanPhoto[],
    musicUrl: null,
    beatGrid: null,
    musicLabel: null,
    targetSec: TEASER_TARGET_SEC,
  };

  const eventId = readChapterGalleryEventId(substrate);
  if (!eventId) {
    return {
      ...base,
      canRender: false,
      reason:
        'Add a Papic gallery id to this chapter’s substrate first — the teaser is built from that gallery’s photos.',
    };
  }

  let gallery: GalleryPhoto[];
  try {
    gallery = await fetchPapicGallery(supabase, eventId);
  } catch {
    gallery = [];
  }

  const photos: TeaserPlanPhoto[] = gallery
    .filter((p) => p.kind === 'photo' && typeof p.url === 'string' && p.url)
    .slice(0, TEASER_MAX_PHOTOS)
    .map((p) => ({ clipId: p.id, url: p.url as string }));

  if (photos.length < TEASER_MIN_PHOTOS) {
    return {
      ...base,
      canRender: false,
      reason: `Need at least ${TEASER_MIN_PHOTOS} photos in that Papic gallery to build a teaser — found ${photos.length}. (Only galleries you have access to can be used.)`,
    };
  }

  // OWNED MUSIC ONLY — resolved exclusively from the Setnayan-owned catalogue.
  const music = await pickOwnedReelMusic();

  return {
    canRender: true,
    reason: null,
    photos,
    musicUrl: music?.url ?? null,
    beatGrid: music?.beatGrid ?? null,
    musicLabel: music?.displayName ?? null,
    targetSec: TEASER_TARGET_SEC,
  };
}
